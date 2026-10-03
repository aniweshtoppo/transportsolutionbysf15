import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB || "mobility_desk";
    const db = client.db(dbName);
    
    // Ping database to verify active connection
    await db.command({ ping: 1 });

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Database connection failed";
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: errorMessage,
      },
      { status: 503 }
    );
  }
}
