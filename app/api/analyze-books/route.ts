import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const BATCH_SIZE = 5;

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
    console.log("3. Request data:", {
      booksCount: books?.length,
      topicId: topic?.id,
      sampleBook: books?.[0]?.volumeInfo?.title,
    });

    if (!books || !topic) {
      return NextResponse.json(
        { error: "Books and topic are required" },
        { status: 400 }
      );
    }

    // Check for already analyzed books
    const { data: existingBooks } = await supabase
      .from("Books")
      .select("google_books_id, analyzed")
      .in(
        "google_books_id",
        books.map((b) => b.id)
      )
      .eq("analyzed", true);

    const unanalyzedBooks = books.filter(
      (book) => !existingBooks?.find((eb) => eb.google_books_id === book.id)
    );

    if (unanalyzedBooks.length === 0) {
      console.log("All books are already analyzed");
      return NextResponse.json({ message: "All books are already analyzed" });
    }

    console.log(`Found ${unanalyzedBooks.length} unanalyzed books`);

    // Split books into batches
    const batches = [];
    for (let i = 0; i < unanalyzedBooks.length; i += BATCH_SIZE) {
      batches.push(unanalyzedBooks.slice(i, i + BATCH_SIZE));
    }

    console.log(`Split into ${batches.length} batches of ${BATCH_SIZE}`);

    let allAnalysis = { books: [] };

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length}`);

      try {
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
          ${JSON.stringify(batch, null, 2)}

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

        const completion = await openai.chat.completions
          .create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4o",
            temperature: 0,
          })
          .catch((error) => {
            console.error("OpenAI Error in batch ${i + 1}:", {
              type: error.type,
              message: error.message,
              param: error.param,
              code: error.code,
            });
            throw error;
          });

        let batchAnalysis;
        try {
          const analysisText = completion.choices[0].message.content;
          const cleanText = analysisText
            ?.replace(/^```json\n|\n```$|^`|`$/g, "")
            .trim();
          batchAnalysis = JSON.parse(cleanText || "{}");
          allAnalysis.books = [...allAnalysis.books, ...batchAnalysis.books];
        } catch (parseError) {
          console.error(`JSON Parse Error in batch ${i + 1}:`, {
            error: parseError,
            rawText: completion.choices[0].message.content,
          });
          continue; // Skip to next batch on parse error
        }

        // Save batch results
        for (const book of batchAnalysis.books) {
          console.log("Saving book with topic:", {
            bookId: book.id,
            topicId: topic?.id,
            bookTitle: batch.find((b) => b.id === book.id)?.volumeInfo.title,
          });

          const bookResult = await supabase.from("Books").upsert({
            google_books_id: book.id,
            level: book.difficulty,
            title: batch.find((b) => b.id === book.id)?.volumeInfo.title,
            author: batch.find((b) => b.id === book.id)?.volumeInfo
              .authors?.[0],
            description: batch.find((b) => b.id === book.id)?.volumeInfo
              .description,
            topic_id: topic?.id,
            analyzed: true,
            last_analyzed: new Date().toISOString(),
          });

          if (bookResult.error) {
            console.error(
              `Error saving book in batch ${i + 1}:`,
              bookResult.error
            );
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

          if (connections.length > 0) {
            const { error: connectionError } = await supabase
              .from("Skill_Map")
              .insert(connections);

            if (connectionError) {
              console.error(
                `Error saving connections in batch ${i + 1}:`,
                connectionError
              );
            }
          }
        }

        console.log(`Successfully processed batch ${i + 1}/${batches.length}`);
      } catch (batchError) {
        console.error(`Error processing batch ${i + 1}:`, batchError);
        continue; // Continue with next batch on error
      }
    }

    console.log("All batches processed");

    return NextResponse.json({
      success: true,
      analysis: allAnalysis,
      booksProcessed: unanalyzedBooks.length,
      batchesProcessed: batches.length,
    });
  } catch (error) {
    console.error("Analysis Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to analyze books" },
      { status: 500 }
    );
  }
}
