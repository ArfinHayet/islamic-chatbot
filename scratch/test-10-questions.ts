import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/chat/chat.service';
import { DataSource } from 'typeorm';

const QUESTIONS = [
  'what quran says about eating',
  'what quran says about exercising',
  'what is the ruling on charity and zakat?',
  'how many rakaat in fajr prayer?',
  'what is the significance of Hajj in Islam?',
  'tell me about the character of Prophet Muhammad',
  'what does Islam say about parents?',
  'is lying allowed in Islam?',
  'tell me a recipe for chocolate cake',
  'what is the capital of France?'
];

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const chatService = app.get(ChatService);
  const dataSource = app.get(DataSource);

  console.log('Clearing RAG Cache...');
  await dataSource.query('TRUNCATE TABLE islamic_cache');

  for (let i = 0; i < QUESTIONS.length; i++) {
    const question = QUESTIONS[i];
    console.log(`\n==================================================`);
    console.log(`Question ${i + 1}/${QUESTIONS.length}: "${question}"`);
    console.log(`==================================================`);

    let fullText = '';
    let hasError = false;

    try {
      for await (const chunk of chatService.chatStream(`test-user-${i}`, question)) {
        if (chunk.type === 'chunk') {
          fullText += chunk.text;
        } else if (chunk.type === 'error') {
          console.error(`Received Error Event:`, chunk.message);
          hasError = true;
        } else if (chunk.type === 'done') {
          console.log(`Received Done Event. Source: ${chunk.source}`);
        }
      }
      
      if (!hasError) {
        console.log(`Response received successfully (${fullText.length} chars).`);
        console.log(`Preview: "${fullText.substring(0, 150).replace(/\n/g, ' ')}..."`);
      }
    } catch (err) {
      console.error(`Execution threw exception:`, err);
    }
  }

  await app.close();
}

run().catch(console.error);
