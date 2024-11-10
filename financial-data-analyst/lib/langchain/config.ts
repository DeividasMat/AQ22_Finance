import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const getModel = (provider: string, modelName: string) => {
  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({
        modelName: modelName, // claude-3-opus-20240229
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    
    case 'openai':
      return new ChatOpenAI({
        modelName: modelName, // gpt-4-turbo-preview
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    
    case 'google':
      return new ChatGoogleGenerativeAI({
        modelName: modelName, // gemini-pro
        apiKey: process.env.GOOGLE_API_KEY,
      });
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}; 