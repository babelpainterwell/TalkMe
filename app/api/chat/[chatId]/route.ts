import dotenv from "dotenv";
import { StreamingTextResponse, LangChainStream } from "ai";
import { auth, currentUser } from "@clerk/nextjs";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";
import { NextResponse } from "next/server";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

dotenv.config({ path: `.env` });

export async function POST(
    request: Request,
    { params }: { params: { chatId: string } }
  ) {
    try {
      const { prompt } = await request.json();
      const user = await currentUser();
  
      if (!user || !user.firstName || !user.id) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
  
      const identifier = request.url + "-" + user.id;
      const { success } = await rateLimit(identifier);
  
      if (!success) {
        return new NextResponse("Rate limit exceeded", { status: 429 });
      }
  
      const figure = await prismadb.figure.update({
        where: {
          id: params.chatId
        },
        data: {
          messages: {
            create: {
              content: prompt,
              role: "user",
              userId: user.id,
            },
          },
        }
      });
  
      if (!figure) {
        return new NextResponse("Figure not found", { status: 404 });
      }
  
      const name = figure.id;
      const figure_file_name = name + ".txt";
  
      const figureKey = {
        figureName: name,
        userId: user.id,
        modelName: "llama2-13b",
      };
      console.log("0")
      const memoryManager = await MemoryManager.getInstance();
      console.log("1")
  
      const records = await memoryManager.readLatestHistory(figureKey);
      console.log("2")
      if (records.length === 0) {
        await memoryManager.seedChatHistory(figure.seed, "\n\n", figureKey);
      }
      console.log("3")
      await memoryManager.writeToHistory("User: " + prompt + "\n", figureKey);
  
      // Query Pinecone
      console.log("4")
      const recentChatHistory = await memoryManager.readLatestHistory(figureKey);
  
      // Right now the preamble is included in the similarity search, but that
      // shouldn't be an issue
      console.log("5")
      const similarDocs = await memoryManager.vectorSearch(
        recentChatHistory,
        figure_file_name
      );
      console.log("6")
      let relevantHistory = "";
      if (!!similarDocs && similarDocs.length !== 0) {
        relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
      }
      console.log("7")
      const { handlers } = LangChainStream();
      console.log("8")
      // Call Replicate for inference
      const model = new Replicate({
        model:
          "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
        input: {
          max_length: 2048,
        },
        apiKey: process.env.REPLICATE_API_TOKEN,
        callbackManager: CallbackManager.fromHandlers(handlers),
      });
      console.log("9")
  
      // Turn verbose on for debugging
      model.verbose = true;
  
      const resp = String(
        await model
          .call(
            `
            ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${figure.name}: prefix. 
    
            ${figure.instructions}
    
            Below are relevant details about ${figure.name}'s past and the conversation you are in.
            ${relevantHistory}
    
    
            ${recentChatHistory}\n${figure.name}:
            `
            )
          .catch(console.error)
      );
      console.log("10")
  
      const cleaned = resp.replaceAll(",", "");
      const chunks = cleaned.split("\n");
      const response = chunks[0];
  
      await memoryManager.writeToHistory("" + response.trim(), figureKey);
      var Readable = require("stream").Readable;
      console.log("11")
  
      let s = new Readable();
      console.log("12")
      s.push(response);
      s.push(null);
      if (response !== undefined && response.length > 1) {
        console.log("13")
        memoryManager.writeToHistory("" + response.trim(), figureKey);
        console.log("14")
  
        await prismadb.figure.update({
          where: {
            id: params.chatId
          },
          data: {
            messages: {
              create: {
                content: response.trim(),
                role: "system",
                userId: user.id,
              },
            },
          }
        });
        console.log("15")
      }
  
      return new StreamingTextResponse(s);
    } catch (error) {
        console.log("[CHAT_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
  };