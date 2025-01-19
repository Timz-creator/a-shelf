import { NextResponse } from "next/server";

interface BookResponse {
  items: Book[];
  totalItems: number;
}

interface Book {
  id: string;
  volumeInfo: {
    title: string;
    authors: string[];
    description: string;
    pageCount: number;
    categories?: string[];
    publishedDate: string;
    imageLinks?: {
      thumbnail: string;
    };
    previewLink: string;
    infoLink: string;
    language: string;
    maturityRating: string;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic");

    if (!topic) {
      return NextResponse.json(
        { error: "Topic parameter is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        topic
      )}&key=${
        process.env.GOOGLE_BOOKS_API_KEY
      }&maxResults=40&printType=books&langRestrict=en`
    );

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.statusText}`);
    }

    const rawData = await response.json();

    // Transform and filter the data
    const books: Book[] = rawData.items
      ?.filter((item: any) => {
        const info = item.volumeInfo;
        return (
          info.title &&
          info.authors?.length > 0 &&
          info.description &&
          info.pageCount &&
          info.language === "en"
        );
      })
      .map((item: any) => ({
        id: item.id,
        volumeInfo: {
          title: item.volumeInfo.title,
          authors: item.volumeInfo.authors || [],
          description: item.volumeInfo.description,
          pageCount: item.volumeInfo.pageCount,
          categories: item.volumeInfo.categories || [],
          publishedDate: item.volumeInfo.publishedDate || "",
          imageLinks: item.volumeInfo.imageLinks || undefined,
          previewLink: item.volumeInfo.previewLink || "",
          infoLink: item.volumeInfo.infoLink || "",
          language: item.volumeInfo.language || "en",
          maturityRating: item.volumeInfo.maturityRating || "NOT_MATURE",
        },
      }));

    const transformedData: BookResponse = {
      items: books,
      totalItems: books.length,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("Error fetching books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}
