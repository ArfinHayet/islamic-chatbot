export interface ScenarioOptionResponse {
  text: string;
  virtue: string;
  delta: number;
  reflection: string;
}

export interface ScenarioResponse {
  id: string;
  level: number;
  district: string;
  situation: string;
  options: ScenarioOptionResponse[];
}
