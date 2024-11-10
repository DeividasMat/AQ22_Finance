import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { getModel } from "./config";
import { z } from "zod";

// Parser for structured financial analysis
const financialAnalysisParser = StructuredOutputParser.fromZodSchema(z.object({
  insights: z.array(z.string()),
  trends: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
}));

// Financial Analysis Chain with structured output
export const createStructuredAnalysisChain = (provider: string, modelName: string) => {
  const model = getModel(provider, modelName);

  const prompt = ChatPromptTemplate.fromTemplate(`
    Analyze this financial data and provide a structured response:
    {data}
    
    ${financialAnalysisParser.getFormatInstructions()}
  `);

  return RunnableSequence.from([
    prompt,
    model,
    financialAnalysisParser,
  ]);
}; 