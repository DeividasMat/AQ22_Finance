import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { getModel } from "./config";

// Financial Analysis Chain
export const createAnalysisChain = (provider: string, modelName: string) => {
  const model = getModel(provider, modelName);

  const prompt = ChatPromptTemplate.fromTemplate(`
    Analyze this financial data:
    {data}
    
    Provide:
    1. Key insights
    2. Notable trends
    3. Potential risks
    4. Recommendations
  `);

  return RunnableSequence.from([
    prompt,
    model,
    new StringOutputParser(),
  ]);
};

// Chart Generation Chain
export const createChartChain = (provider: string, modelName: string) => {
  const model = getModel(provider, modelName);

  const prompt = ChatPromptTemplate.fromTemplate(`
    Create a {chartType} chart visualization for:
    {data}
    
    Return the chart configuration as a valid JSON object with:
    1. Chart type
    2. Data series
    3. Labels
    4. Colors
    5. Title
  `);

  return RunnableSequence.from([
    prompt,
    model,
    new StringOutputParser(),
  ]);
}; 