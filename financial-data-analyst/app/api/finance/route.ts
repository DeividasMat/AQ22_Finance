// app/api/finance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAnalysisChain, createChartChain } from "@/lib/langchain/chains";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider, chartType } = await req.json();

    // Get the last user message
    const userMessage = messages
      .filter((m: any) => m.role === "user")
      .pop();

    // Create appropriate chain based on content
    const chain = chartType 
      ? createChartChain(provider, model)
      : createAnalysisChain(provider, model);

    // Invoke chain
    const result = await chain.invoke({
      data: userMessage.content,
      chartType: chartType || "bar",
    });

    return NextResponse.json({
      content: result,
      hasToolUse: !!chartType,
    });

  } catch (error) {
    console.error("Chain error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
