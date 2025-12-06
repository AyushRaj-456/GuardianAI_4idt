import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const API_KEY = process.env.GROQ_API_KEY;

if (!API_KEY) {
    console.error("❌ FATAL: GROQ_API_KEY is missing");
}

const groq = new Groq({
    apiKey: API_KEY || "",
});

const BASE_SYSTEM_PROMPT =
    "You are CareConnect AI, a compassionate health assistant. " +
    "Be warm, concise, and helpful. In emergencies, advise calling local emergency services.\n\n" +
    "CAPABILITY: You can send messages to the patient's caretakers if requested.\n" +
    "INSTRUCTION: To send a message, you must output a command in this EXACT format at the end of your response:\n" +
    "<<<SEND_MESSAGE={\"recipientId\": \"ID\", \"message\": \"CONTENT\"}>>>\n" +
    "Example: \"I will tell him. <<<SEND_MESSAGE={\"recipientId\": \"123\", \"message\": \"Help needed\"}>>>\"";

export async function POST(req: Request) {
    if (!API_KEY) {
        return NextResponse.json(
            { error: "API key missing" },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const message = String(body?.message || "").trim();
        const history = Array.isArray(body?.history) ? body.history : [];
        const caretakers = Array.isArray(body?.caretakers) ? body.caretakers : [];

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // Construct dynamic system prompt with caretaker info
        let systemPrompt = BASE_SYSTEM_PROMPT;
        if (caretakers.length > 0) {
            systemPrompt += "\n\nAVAILABLE CARETAKERS:\n";
            caretakers.forEach((c: any) => {
                systemPrompt += `- Name: ${c.name}, ID: ${c.id}\n`;
            });
        } else {
            systemPrompt += "\n\n(No caretakers are currently connected.)";
        }

        // Convert history to OpenAI/Groq format
        const messages: any[] = [
            { role: "system", content: systemPrompt },
            ...history.map((msg: any) => {
                let content = "";
                if (typeof msg.parts === "string") {
                    content = msg.parts;
                } else if (Array.isArray(msg.parts)) {
                    content = msg.parts[0]?.text || "";
                } else {
                    content = msg.text || msg.content || "";
                }
                return {
                    role: msg.role === "model" ? "assistant" : msg.role,
                    content: content
                };
            }),
            { role: "user", content: message }
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const text = completion.choices[0]?.message?.content || "";

        return NextResponse.json({ text });

    } catch (error: any) {
        console.error("❌ Groq Fatal Error:", error.message);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
