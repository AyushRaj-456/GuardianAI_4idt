import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { activityData } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
      Analyze the following patient activity data and determine if there is a safety risk.
      The patient is expected to be active during the day.
      
      Data: ${JSON.stringify(activityData)}
      
      If the patient has been inactive for too long or shows abnormal patterns, return a JSON object with:
      { "riskLevel": "high" | "medium" | "low", "alert": "Reason for alert" }
      
      Otherwise return:
      { "riskLevel": "low", "alert": null }
      
      Return ONLY valid JSON.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return NextResponse.json(JSON.parse(jsonStr));
    } catch (error) {
        console.error("Error in analyze API:", error);
        return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
    }
}
