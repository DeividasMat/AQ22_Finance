import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/memory";

export const createChatMemory = () => {
  return new BufferMemory({
    chatHistory: new ChatMessageHistory(),
    returnMessages: true,
    memoryKey: "chat_history",
  });
}; 