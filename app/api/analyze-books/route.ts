import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

// Types for our analysis
interface BookAnalysis {
  id: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  nextBooks: string[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { books, topic } = await request.json();

    if (!books || !topic) {
      return NextResponse.json(
        { error: "Books and topic are required" },
        { status: 400 }
      );
    }

    const prompt = `
      Analyze these ${topic} books and create a learning path.
      For each book provide:
      1. Difficulty level (beginner/intermediate/advanced)
      2. Required prerequisite books (by ID) - books that should be read before this one
      3. Recommended next books (by ID) - books that naturally follow this one

      Important:
      - Beginner books should have no prerequisites
      - Advanced books should have prerequisites
      - Create natural progression paths between books
      - Connect books based on complexity and topic coverage
      - Ensure each non-beginner book has at least one prerequisite
      - Ensure each non-advanced book suggests at least one next book

      Books to analyze:
      ${JSON.stringify(books, null, 2)}

      Provide analysis in JSON format with this structure:
      {
        "books": [
          {
            "id": "book_id",
            "difficulty": "beginner|intermediate|advanced",
            "prerequisites": ["book_id1", "book_id2"],
            "nextBooks": ["book_id3", "book_id4"]
          }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o",
    });

    const analysisText = completion.choices[0].message.content;
    // Clean the response by removing backticks and any markdown JSON indicators
    const cleanText = analysisText
      ?.replace(/^```json\n|\n```$|^`|`$/g, "")
      .trim();
    const analysis = JSON.parse(cleanText || "{}");

    // After parsing
    console.log("Analysis:", analysis);

    // Save books and their relationships
    for (const book of analysis.books) {
      // Before saving
      console.log("Saving book:", book.id, book.difficulty);

      // Save book with difficulty
      const bookResult = await supabase.from("Books").upsert({
        google_books_id: book.id,
        level: book.difficulty,
        title: books.find((b) => b.id === book.id)?.volumeInfo.title,
        author: books.find((b) => b.id === book.id)?.volumeInfo.authors?.[0],
        description: books.find((b) => b.id === book.id)?.volumeInfo
          .description,
      });

      console.log("Book upsert result:", bookResult);

      // Before saving relationships
      console.log("Prerequisites:", book.prerequisites);
      console.log("Next books:", book.nextBooks);

      // Save prerequisites to Skill_Map
      for (const prereqId of book.prerequisites) {
        const prereqResult = await supabase.from("Skill_Map").upsert({
          from_book_id: prereqId,
          to_book_id: book.id,
          difficulty_level: book.difficulty,
        });
        console.log("Prerequisite upsert result:", prereqResult);
      }

      // Save next books to Skill_Map
      for (const nextBookId of book.nextBooks) {
        const nextResult = await supabase.from("Skill_Map").upsert({
          from_book_id: book.id,
          to_book_id: nextBookId,
          difficulty_level: book.difficulty,
        });
        console.log("Next book upsert result:", nextResult);
      }
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Error analyzing books:", error);
    return NextResponse.json(
      { error: "Failed to analyze books" },
      { status: 500 }
    );
  }
}
