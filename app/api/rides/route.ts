import { NextRequest, NextResponse } from "next/server";
import { getAllRides, createRide } from "@/lib/ridesStore";
import { LOCATIONS, LocationName, Passenger } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedBy = searchParams.get("requestedBy")?.trim();
    const role = searchParams.get("role");
    const name = searchParams.get("name")?.trim();

    let rides = await getAllRides();

    // Filter by requestedBy if provided
    if (requestedBy) {
      rides = rides.filter(
        (r) =>
          r.requestedBy.name.toLowerCase() === requestedBy.toLowerCase() ||
          r.passengers.some((p) => p.name.toLowerCase() === requestedBy.toLowerCase())
      );
    } else if (role === "student" || role === "employee") {
      if (name) {
        rides = rides.filter(
          (r) =>
            r.requestedBy.name.toLowerCase() === name.toLowerCase() ||
            r.passengers.some((p) => p.name.toLowerCase() === name.toLowerCase())
        );
      }
    }

    const status = searchParams.get("status");
    if (status) {
      rides = rides.filter((r) => r.status === status);
    }

    return NextResponse.json({ rides }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch rides";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestedBy, from, to, scheduledAt, passengers } = body;

    // Server-side validation
    if (!requestedBy || !requestedBy.name || !requestedBy.name.trim()) {
      return NextResponse.json(
        { error: "Requester name is required." },
        { status: 400 }
      );
    }

    if (!requestedBy.role || !["student", "employee"].includes(requestedBy.role)) {
      return NextResponse.json(
        { error: "Requester role must be either student or employee." },
        { status: 400 }
      );
    }

    if (!LOCATIONS.includes(from as LocationName)) {
      return NextResponse.json(
        { error: "Invalid pickup location. Must be College, Station, or Office." },
        { status: 400 }
      );
    }

    if (!LOCATIONS.includes(to as LocationName)) {
      return NextResponse.json(
        { error: "Invalid destination location. Must be College, Station, or Office." },
        { status: 400 }
      );
    }

    if (from === to) {
      return NextResponse.json(
        { error: "Pickup and destination locations cannot be the same." },
        { status: 400 }
      );
    }

    if (!scheduledAt || typeof scheduledAt !== "string" || !scheduledAt.trim()) {
      return NextResponse.json(
        { error: "Scheduled date and time is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return NextResponse.json(
        { error: "At least one passenger is required." },
        { status: 400 }
      );
    }

    // Process and sanitize passenger names (accept strings or passenger objects)
    const validPassengers: Passenger[] = passengers
      .map((p: unknown) => {
        if (typeof p === "string") return p.trim();
        if (p && typeof p === "object" && "name" in p && typeof p.name === "string") {
          return p.name.trim();
        }
        return "";
      })
      .filter((name: string) => name.length > 0)
      .map((name: string) => ({
        name,
        pickupStatus: "pending" as const,
      }));

    if (validPassengers.length === 0) {
      return NextResponse.json(
        { error: "At least one valid non-empty passenger name is required." },
        { status: 400 }
      );
    }

    const createdRide = await createRide({
      requestedBy: {
        name: requestedBy.name.trim(),
        role: requestedBy.role,
      },
      from: from as LocationName,
      to: to as LocationName,
      scheduledAt: scheduledAt.trim(),
      passengers: validPassengers,
    });

    return NextResponse.json(
      { success: true, ride: createdRide },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create ride request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
