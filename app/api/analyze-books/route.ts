import { NextResponse } from "next/server";
import OpenAI from "openai";

// Types for our analysis
interface BookAnalysis {
  id: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  concepts: string[];
  nextBooks: string[];
  pathPosition: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { books, topic } = await request.json();

    if (!books || !topic) {
      return NextResponse.json(
        { error: "Books and topic are required" },
        { status: 400 }
      );
    }

    const prompt = `
      Analyze these ${topic} programming books and categorize them.
      For each book provide:
      1. Difficulty level (beginner/intermediate/advanced)
      2. Key programming concepts covered
      3. Required prerequisite books (by ID)
      4. Recommended next books (by ID)
      5. Position in learning path

      Books to analyze:
      ${JSON.stringify(books, null, 2)}

      Provide analysis in JSON format.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-turbo-preview",
    });

    const analysis = completion.choices[0].message.content;

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error analyzing books:", error);
    return NextResponse.json(
      { error: "Failed to analyze books" },
      { status: 500 }
    );
  }
}
