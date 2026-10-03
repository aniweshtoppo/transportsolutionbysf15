import { NextRequest, NextResponse } from "next/server";
import { completeRide } from "@/lib/ridesStore";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await completeRide(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ride: result.ride }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete ride";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
