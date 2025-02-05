import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Types for our analysis
interface BookAnalysis {
  id: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  nextBooks: string[];
}

// Add validation types
type ValidationError = {
  bookId: string;
  issues: string[];
};

// Add validation function
function validateAnalysis(analysis: {
  books: BookAnalysis[];
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const bookMap = new Map(analysis.books.map((b) => [b.id, b]));

  for (const book of analysis.books) {
    const issues: string[] = [];

    // Count connections
    const incomingCount = analysis.books.filter((b) =>
      b.nextBooks.includes(book.id)
    ).length;
    const outgoingCount = book.nextBooks.length;

    // Check based on level
    switch (book.difficulty) {
      case "beginner":
        if (outgoingCount < 2) {
          issues.push(
            `Beginner book has only ${outgoingCount} outgoing connections, needs at least 2`
          );
        }
        break;
      case "intermediate":
        if (incomingCount < 2) {
          issues.push(
            `Intermediate book has only ${incomingCount} incoming connections, needs at least 2`
          );
        }
        if (outgoingCount < 2) {
          issues.push(
            `Intermediate book has only ${outgoingCount} outgoing connections, needs at least 2`
          );
        }
        break;
      case "advanced":
        if (incomingCount < 2) {
          issues.push(
            `Advanced book has only ${incomingCount} incoming connections, needs at least 2`
          );
        }
        break;
    }

    // Check for isolation
    if (book.difficulty !== "beginner" && incomingCount === 0) {
      issues.push("Book has no incoming connections");
    }
    if (book.difficulty !== "advanced" && outgoingCount === 0) {
      issues.push("Book has no outgoing connections");
    }

    if (issues.length > 0) {
      errors.push({ bookId: book.id, issues });
    }
  }

  return errors;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRIES = 3; // Maximum number of analysis attempts

export async function POST(request: Request) {
  try {
    console.log("1. Starting analyze-books endpoint");
    const supabase = createRouteHandlerClient({ cookies });

    // Log session check
    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log("2. Auth check:", {
      hasSession: !!session,
      timestamp: new Date().toISOString(),
    });

    // Log request data
    const { books, topic } = await request.json();
    console.log("2. Received request:", {
      booksCount: books?.length,
      topicId: topic?.id,
      firstBook: books?.[0]?.volumeInfo?.title,
    });

    if (!books?.length || !topic) {
      return NextResponse.json(
        { error: "Books and topic are required" },
        { status: 400 }
      );
    }

    // Single check for existing analyzed books
    const { data: existingBooks } = await supabase
      .from("Books")
      .select("*")
      .eq("topic_id", topic.id)
      .eq("analyzed", true);

    if (existingBooks?.length > 0) {
      console.log("Found existing analyzed books:", existingBooks.length);

      // Get existing connections
      const { data: existingConnections } = await supabase
        .from("Skill_Map")
        .select("*")
        .in("from_book_id", existingBooks?.map((b) => b.google_books_id) ?? []);

      if (existingConnections?.length > 0) {
        console.log("Found existing connections:", existingConnections.length);
        return NextResponse.json({
          success: true,
          books: existingBooks,
          connections: existingConnections,
          reused: true,
        });
      }
    }

    // Analyze all books if none exist
    console.log("No existing analysis found, analyzing all books");
    const prompt = `
      Return ONLY JSON, no explanations or markdown formatting.
      Analyze these ${topic.title} books into a learning path.
      For each book provide:
      1. Difficulty level (beginner/intermediate/advanced)
      2. Required prerequisite books (by ID)
      3. Recommended next books (by ID)

      CRITICAL CONNECTION REQUIREMENTS:

      1. Connection Quantity Rules:
         Beginner Books:
         - MUST have at least 2 connections TO intermediate books
         - No incoming connections required (they are starting points)
         
         Intermediate Books:
         - MUST have at least 2 connections FROM beginner books
         - MUST have at least 2 connections TO advanced books
         
         Advanced Books:
         - MUST have at least 2 connections FROM intermediate books
         - No outgoing connections required (they are end points)

      2. Isolation Prevention:
         - NO book can exist without connections
         - Every book must be reachable in the learning path
         - Create additional connections if needed to ensure this

      3. Level Progression:
         - Connections MUST follow: beginner -> intermediate -> advanced
         - Never skip levels (no beginner -> advanced)
         - Create all possible valid connections

      Books to analyze:
      ${JSON.stringify(books, null, 2)}

      RESPONSE FORMAT (use exactly this structure, no other text):
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

    // Analysis retry loop
    let analysisAttempt = 0;
    let analysis = null;
    let validationErrors = [];

    while (analysisAttempt < MAX_RETRIES) {
      analysisAttempt++;
      console.log(`Analysis attempt ${analysisAttempt}/${MAX_RETRIES}`);

      try {
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o",
          temperature: analysisAttempt * 0.1,
        });

        console.log("OpenAI Response:", {
          status: completion.status,
          model: completion.model,
          responseLength: completion.choices[0].message.content.length,
        });

        const analysisText = completion.choices[0].message.content;
        console.log("Raw Analysis:", analysisText);

        // Extract JSON portion
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : "{}";

        // Clean and parse
        const cleanText = jsonText
          .replace(/[\u201C\u201D\u2018\u2019]/g, '"')
          .trim();
        analysis = JSON.parse(cleanText || "{}");
        console.log("Parsed Analysis:", {
          bookCount: analysis?.books?.length,
          firstBook: analysis?.books?.[0],
        });

        validationErrors = validateAnalysis(analysis);
      } catch (attemptError) {
        console.error("Error in analysis attempt:", {
          attempt: analysisAttempt,
          error: {
            name: attemptError.name,
            message: attemptError.message,
            code: attemptError.code,
            type: attemptError.type,
            raw: attemptError,
          },
        });
        continue; // Try next attempt
      }

      if (validationErrors.length === 0) {
        console.log(`Valid analysis found on attempt ${analysisAttempt}`);
        break; // Valid analysis found, exit loop
      }

      console.error(
        `Validation failed on attempt ${analysisAttempt}:`,
        validationErrors
      );
    }

    // If all retries failed
    if (validationErrors.length > 0) {
      console.error("All analysis attempts failed validation");
      return NextResponse.json(
        {
          error: "Failed to generate valid analysis after multiple attempts",
          details: validationErrors,
          attempts: analysisAttempt,
        },
        { status: 400 }
      );
    }

    // Save results
    let allConnections = [];
    for (const book of analysis.books) {
      console.log("Saving book with topic:", {
        bookId: book.id,
        topicId: topic?.id,
        bookTitle: books.find((b) => b.id === book.id)?.volumeInfo.title,
      });

      const bookResult = await supabase.from("Books").upsert({
        google_books_id: book.id,
        level: book.difficulty,
        title: books.find((b) => b.id === book.id)?.volumeInfo.title,
        author: books.find((b) => b.id === book.id)?.volumeInfo.authors?.[0],
        description: books.find((b) => b.id === book.id)?.volumeInfo
          .description,
        topic_id: topic?.id,
        analyzed: true,
        last_analyzed: new Date().toISOString(),
      });

      if (bookResult.error) {
        console.error(`Error saving book:`, bookResult.error);
        continue;
      }

      // Save relationships to Skill_Map
      const connections = [
        ...book.prerequisites.map((prereqId) => ({
          from_book_id: prereqId,
          to_book_id: book.id,
          difficulty_level: book.difficulty,
        })),
        ...book.nextBooks.map((nextBookId) => ({
          from_book_id: book.id,
          to_book_id: nextBookId,
          difficulty_level: book.difficulty,
        })),
      ];

      allConnections = [...allConnections, ...connections];

      if (connections.length > 0) {
        const { error: connectionError } = await supabase
          .from("Skill_Map")
          .upsert(connections, {
            onConflict: "from_book_id,to_book_id",
          });

        if (connectionError) {
          console.error(`Error saving connections:`, connectionError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      books: analysis.books,
      connections: allConnections,
      reused: false,
    });
  } catch (error) {
    console.error("Fatal Analysis Error:", {
      name: error.name,
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
      isOpenAIError: error instanceof OpenAI.APIError,
      isJSONError: error instanceof SyntaxError,
      raw: error,
    });

    let errorMessage = "Failed to analyze books";
    if (error instanceof OpenAI.APIError) {
      errorMessage = "AI service temporarily unavailable";
    } else if (error instanceof SyntaxError) {
      errorMessage = "Invalid analysis format";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        type: error.name,
        details: error.message,
      },
      { status: 500 }
    );
  }
}
