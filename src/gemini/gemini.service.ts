import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  Content,
  FunctionDeclaration,
  FunctionCallingMode,
} from '@google/generative-ai';
import { McpService } from '../mcp/mcp.service';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: { result: string } };
  }>;
}

export interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mcpService: McpService,
  ) {
    const apiKey = this.configService.get<string>('gemini.apiKey') ?? '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.chatModel = this.configService.get<string>('gemini.chatModel') ?? 'gemini-1.5-flash';
    this.embeddingModel =
      this.configService.get<string>('gemini.embeddingModel') ?? 'text-embedding-004';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent({
        content: { parts: [{ text }], role: 'user' },
        outputDimensionality: 768,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return result.embedding.values;
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${(error as Error).message}`);
      throw new HttpException('Embedding service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async runAgenticLoop(
    systemPrompt: string,
    history: GeminiMessage[],
    tools: GeminiTool[],
  ): Promise<string> {
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })) as unknown as FunctionDeclaration[];

    const model = this.genAI.getGenerativeModel({
      model: this.chatModel,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    });

    // Exclude the last user message from history — it will be sent via sendMessage
    const sdkHistory: Content[] = history.slice(0, -1).map((m) => ({
      role: m.role,
      parts: m.parts.map((p) => {
        if (p.functionCall) return { functionCall: p.functionCall };
        if (p.functionResponse)
          return {
            functionResponse: {
              name: p.functionResponse.name,
              response: p.functionResponse.response,
            },
          };
        return { text: p.text ?? '' };
      }),
    }));

    const chatSession = model.startChat({ history: sdkHistory });
    const maxIterations = 10;

    // Send only the current (last) user message
    const lastUserMessage = history[history.length - 1];
    const userText = lastUserMessage?.parts.find((p) => p.text)?.text ?? '';

    try {
      let result = await chatSession.sendMessage(userText);

      for (let i = 0; i < maxIterations; i++) {
        const parts = result.response.candidates?.[0]?.content?.parts ?? [];
        const functionCallPart = parts.find((p) => 'functionCall' in p && p.functionCall);

        if (!functionCallPart?.functionCall) {
          // No tool call — return the final text response
          return result.response.text();
        }

        const { name, args } = functionCallPart.functionCall;
        this.logger.log(`Tool call: ${name}(${JSON.stringify(args)})`);

        const toolResult = await this.mcpService.executeTool(
          name,
          args as Record<string, string>,
        );
        this.logger.log(`Tool result [${name}]: ${JSON.stringify(toolResult)}`);

        result = await chatSession.sendMessage([
          {
            functionResponse: {
              name,
              response: { result: JSON.stringify(toolResult) },
            },
          },
        ]);
      }

      return result.response.text();
    } catch (error) {
      this.logger.error(`Agentic loop failed: ${(error as Error).message}`);
      throw new HttpException('Chat service unavailable', HttpStatus.BAD_GATEWAY);
    }
  }
}
