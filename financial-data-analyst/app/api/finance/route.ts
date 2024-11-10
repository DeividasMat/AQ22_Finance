// app/api/finance/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChartData } from "@/types/chart";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Anthropic client with correct headers
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export const runtime = "edge";

// Helper to validate base64
const isValidBase64 = (str: string) => {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
};

// Add Type Definitions
interface ChartToolResponse extends ChartData {
  // Any additional properties specific to the tool response
}

interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const tools: ToolSchema[] = [
  {
    name: "generate_graph_data",
    description:
      "Generate structured JSON data for creating financial charts and graphs.",
    input_schema: {
      type: "object" as const,
      properties: {
        chartType: {
          type: "string" as const,
          enum: [
            "bar",
            "multiBar",
            "line",
            "pie",
            "area",
            "stackedArea",
          ] as const,
          description: "The type of chart to generate",
        },
        config: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const },
            description: { type: "string" as const },
            trend: {
              type: "object" as const,
              properties: {
                percentage: { type: "number" as const },
                direction: {
                  type: "string" as const,
                  enum: ["up", "down"] as const,
                },
              },
              required: ["percentage", "direction"],
            },
            footer: { type: "string" as const },
            totalLabel: { type: "string" as const },
            xAxisKey: { type: "string" as const },
          },
          required: ["title", "description"],
        },
        data: {
          type: "array" as const,
          items: {
            type: "object" as const,
            additionalProperties: true, // Allow any structure
          },
        },
        chartConfig: {
          type: "object" as const,
          additionalProperties: {
            type: "object" as const,
            properties: {
              label: { type: "string" as const },
              stacked: { type: "boolean" as const },
            },
            required: ["label"],
          },
        },
      },
      required: ["chartType", "config", "data", "chartConfig"],
    },
  },
];

// Add type for API selection
type AIProvider = 'anthropic' | 'openai' | 'google';

export async function POST(req: NextRequest) {
  try {
    const { messages, fileData, model, provider = 'anthropic' } = await req.json();

    console.log("🔍 Initial Request Data:", {
      hasMessages: !!messages,
      messageCount: messages?.length,
      hasFileData: !!fileData,
      fileType: fileData?.mediaType,
      model,
      provider
    });

    let response;

    switch (provider) {
      case 'openai':
        // Convert messages to OpenAI format
        const openaiMessages = messages.map((msg: any) => {
          // Handle messages with files
          if (msg.file && msg.file.mediaType?.startsWith("image/")) {
            return {
              role: msg.role,
              content: [
                {
                  type: "text",
                  text: msg.content
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${msg.file.mediaType};base64,${msg.file.base64}`
                  }
                }
              ]
            };
          }
          
          // Handle regular text messages
          return {
            role: msg.role,
            content: msg.content
          };
        });

        // Handle the latest file upload if present
        if (fileData && fileData.mediaType?.startsWith("image/")) {
          const lastMessage = openaiMessages[openaiMessages.length - 1];
          openaiMessages[openaiMessages.length - 1] = {
            role: "user",
            content: [
              {
                type: "text",
                text: lastMessage.content
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileData.mediaType};base64,${fileData.base64}`
                }
              }
            ]
          };
        }

        console.log("OpenAI Request:", {
          model,
          messages: openaiMessages.map(m => ({
            role: m.role,
            contentTypes: Array.isArray(m.content) 
              ? m.content.map(c => c.type)
              : 'text'
          }))
        });

        // Make sure to use a vision-capable model
        const openaiResponse = await openai.chat.completions.create({
          model: model === 'gpt-4' ? 'gpt-4-vision-preview' : model,
          messages: openaiMessages,
          max_tokens: 4096,
          temperature: 0.7,
        });

        return new Response(
          JSON.stringify({
            content: openaiResponse.choices[0].message.content,
            hasToolUse: false
          })
        );

      case 'google':
        const geminiModel = genAI.getGenerativeModel({ model: model });
        
        // Handle image for Google
        let geminiContent;
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage.file?.mediaType?.startsWith("image/")) {
          geminiContent = {
            contents: [{
              role: 'user',
              parts: [
                { text: lastMessage.content },
                {
                  inlineData: {
                    mimeType: lastMessage.file.mediaType,
                    data: lastMessage.file.base64
                  }
                }
              ]
            }]
          };
        } else {
          geminiContent = {
            contents: [{
              role: 'user',
              parts: [{ text: lastMessage.content }]
            }]
          };
        }

        const geminiResponse = await geminiModel.generateContent(geminiContent);
        const result = await geminiResponse.response;

        return new Response(
          JSON.stringify({
            content: result.text(),
            hasToolUse: false
          })
        );

      case 'anthropic':
      default:
        // Process messages for Anthropic
        let anthropicMessages = messages.map((msg: any) => {
          if (msg.file) {
            if (msg.file.isText) {
              return {
                role: msg.role,
                content: `File contents of ${msg.file.fileName}:\n\n${decodeURIComponent(atob(msg.file.base64))}\n\n${msg.content}`
              };
            } else {
              return {
                role: msg.role,
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: msg.file.mediaType,
                      data: msg.file.base64,
                    }
                  },
                  {
                    type: "text",
                    text: msg.content
                  }
                ]
              };
            }
          }
          return {
            role: msg.role,
            content: msg.content
          };
        });

        // Handle file in the latest message if present
        if (fileData) {
          const { base64, mediaType, isText, fileName } = fileData;
          if (base64) {
            try {
              if (isText) {
                const textContent = decodeURIComponent(atob(base64));
                anthropicMessages[anthropicMessages.length - 1] = {
                  role: "user",
                  content: `File contents of ${fileName}:\n\n${textContent}\n\n${messages[messages.length - 1].content}`
                };
              } else if (mediaType.startsWith("image/")) {
                anthropicMessages[anthropicMessages.length - 1] = {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mediaType,
                        data: base64,
                      }
                    },
                    {
                      type: "text",
                      text: messages[messages.length - 1].content
                    }
                  ]
                };
              }
            } catch (error) {
              console.error("Error processing file content:", error);
              return new Response(
                JSON.stringify({ error: "Failed to process file content" }),
                { status: 400 }
              );
            }
          }
        }

        console.log("🚀 Anthropic API Request:", {
          model,
          messageCount: anthropicMessages.length
        });

        const anthropicResponse = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          temperature: 0.7,
          messages: anthropicMessages,
          system: "You are a helpful AI assistant."
        });

        return new Response(
          JSON.stringify({
            content: typeof anthropicResponse.content === 'string' 
              ? anthropicResponse.content 
              : anthropicResponse.content[0].text,
            hasToolUse: false
          })
        );
    }

  } catch (error) {
    console.error("❌ Finance API Error: ", error);
    console.error("Full error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Anthropic.APIError) {
      return new Response(
        JSON.stringify({
          error: "Anthropic API Error",
          details: error.message,
        }),
        { status: 500 }
      );
    }

    if (error instanceof OpenAI.APIError) {
      return new Response(
        JSON.stringify({
          error: "OpenAI API Error",
          details: error.message,
        }),
        { status: 500 }
      );
    }

    if (error.constructor.name === 'GoogleGenerativeAIError') {
      return new Response(
        JSON.stringify({
          error: "Google Generative AI Error",
          details: error.message,
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500 }
    );
  }
}
