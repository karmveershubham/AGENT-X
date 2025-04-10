import {config} from "dotenv";
import readline from 'readline/promises';
import {GoogleGenAI}  from "@google/genai";
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

config();

let tools=[]
const ai=new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});

const mcpClient=new Client({
  name: "example-client",
  version: "1.0.0",
});


const chatHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mcpClient.connect(new SSEClientTransport(
  new URL ("http://localhost:3001/sse")
)).then(async() => {
  console.log("Connected to MCP server.");
  tools = (await mcpClient.listTools()).tools.map(tool => {
    return {
        name: tool.name,
        description: tool.description,
        parameters: {
            type:tool.inputSchema.type,
            properties: tool.inputSchema.properties,
            required: tool.inputSchema.required
        }
    }
  })
  chatLoop();
  // console.log("Available Tools:", tools);
  
}).catch((error) => {
  console.error("Error connecting to server:", error);
});



async function chatLoop(toolCall) {
  if(toolCall){
    console.log(`Calling Tool : ${toolCall.name}`)
    chatHistory.push({
      role:'assistant',
      parts:[{
        text: `Calling tool ${toolCall.name}`,
        type:'text'
      }]
    })
    const toolresult = await mcpClient.callTool({
      name: toolCall.name,
      arguments: toolCall.args
    })

    chatHistory.push({
      role:'user',
      parts:[{
        text: `Tool result is: ${toolresult.content[0].text}`,
        type:'text'
      }
    ]})

  }else{
    const question =await rl.question('You: ');
    chatHistory.push({
      role: 'user',
      parts:[
          { text: question, type: 'text'}
      ]
      });
  }

  // const question = await rl.question('You: ');
  
  // chatHistory.push({ 
  //   role: 'user', 
  //   parts:[
  //       { text: question, type: 'text'}
  //   ]
  //   });
  
   const response = await ai.models.generateContent({
    model:"gemini-2.0-flash",
    contents:chatHistory,
    config:{
        tools:[{
                functionDeclarations:tools,
                }
            ],  
        }
    });

    const functionCall = response.candidates[0].content.parts[0].functionCall;
    const responseText=response.candidates[0].content.parts[0].text;
    
    if(functionCall){
      return chatLoop(functionCall)
    }
    chatHistory.push({ 
        role: 'assistant', 
        parts:[
            { text: responseText, type: 'text'}
        ]
        });

    console.log(`AI: ${responseText}`);

    chatLoop();
}
