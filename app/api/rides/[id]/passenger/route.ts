import { NextRequest, NextResponse } from "next/server";
import { updatePassengerPickupStatus } from "@/lib/ridesStore";

async function handleUpdate(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { passengerIndex, passengerName, pickupStatus } = body;

    if (!pickupStatus || !["boarded", "missed"].includes(pickupStatus)) {
      return NextResponse.json(
        { error: "Invalid pickup status. Must be 'boarded' or 'missed'." },
        { status: 400 }
      );
    }

    if (typeof passengerIndex !== "number" && !passengerName) {
      return NextResponse.json(
        { error: "Either passengerIndex or passengerName is required." },
        { status: 400 }
      );
    }

    const result = await updatePassengerPickupStatus(
      id,
      { index: passengerIndex, name: passengerName },
      pickupStatus
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ride: result.ride }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update passenger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, params);
}
