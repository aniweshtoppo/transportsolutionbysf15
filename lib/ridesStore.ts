import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { Ride, Passenger, LocationName, PickupStatus } from "./types";
import fs from "fs";
import path from "path";

// Local JSON fallback store when MONGODB_URI is not provided
declare global {
  var _fallbackRidesCache: Ride[] | undefined;
}

const FALLBACK_DIR = process.env.VERCEL
  ? path.join("/tmp", "mobility_desk_data")
  : path.join(process.cwd(), "data");
const FALLBACK_FILE = path.join(FALLBACK_DIR, "rides.json");

export function normalizeScheduledAt(val: string): string {
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    }
  } catch {
    // fallback
  }
  return (val || "").trim().slice(0, 16);
}

function readFallbackRides(): Ride[] {
  if (global._fallbackRidesCache && Array.isArray(global._fallbackRidesCache)) {
    return global._fallbackRidesCache;
  }
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    if (!fs.existsSync(FALLBACK_FILE)) {
      const seedFile = path.join(process.cwd(), "data", "rides.json");
      if (fs.existsSync(seedFile)) {
        try {
          const seedData = fs.readFileSync(seedFile, "utf-8");
          const parsed = JSON.parse(seedData) as Ride[];
          global._fallbackRidesCache = parsed;
          fs.writeFileSync(FALLBACK_FILE, seedData, "utf-8");
          return parsed;
        } catch {
          // ignore
        }
      }
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify([]), "utf-8");
      global._fallbackRidesCache = [];
      return [];
    }
    const data = fs.readFileSync(FALLBACK_FILE, "utf-8");
    const parsed = JSON.parse(data) as Ride[];
    global._fallbackRidesCache = parsed;
    return parsed;
  } catch {
    return global._fallbackRidesCache || [];
  }
}

function writeFallbackRides(rides: Ride[]): void {
  global._fallbackRidesCache = rides;
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(rides, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write fallback rides:", e);
  }
}

function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function getAllRides(): Promise<Ride[]> {
  if (isMongoConfigured()) {
    const db = await getDb();
    const docs = await db.collection("rides").find().sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => ({
      _id: doc._id.toString(),
      requestedBy: doc.requestedBy,
      from: doc.from as LocationName,
      to: doc.to as LocationName,
      scheduledAt: doc.scheduledAt,
      passengers: doc.passengers as Passenger[],
      status: doc.status,
      createdAt: doc.createdAt,
      completedAt: doc.completedAt || null,
    }));
  } else {
    const rides = readFallbackRides();
    return rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function getRideById(id: string): Promise<Ride | null> {
  if (isMongoConfigured()) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    const doc = await db.collection("rides").findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return {
      _id: doc._id.toString(),
      requestedBy: doc.requestedBy,
      from: doc.from as LocationName,
      to: doc.to as LocationName,
      scheduledAt: doc.scheduledAt,
      passengers: doc.passengers as Passenger[],
      status: doc.status,
      createdAt: doc.createdAt,
      completedAt: doc.completedAt || null,
    };
  } else {
    const rides = readFallbackRides();
    return rides.find((r) => r._id === id) || null;
  }
}

export async function createRide(
  rideData: Omit<Ride, "_id" | "status" | "createdAt" | "completedAt">
): Promise<Ride> {
  const formattedRide: Omit<Ride, "_id"> = {
    requestedBy: rideData.requestedBy,
    from: rideData.from,
    to: rideData.to,
    scheduledAt: rideData.scheduledAt,
    passengers: rideData.passengers.map((p) => ({
      name: p.name.trim(),
      pickupStatus: "pending",
    })),
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  if (isMongoConfigured()) {
    const db = await getDb();
    const res = await db.collection("rides").insertOne(formattedRide);
    return {
      _id: res.insertedId.toString(),
      ...formattedRide,
    };
  } else {
    const rides = readFallbackRides();
    const newRide: Ride = {
      _id: "local_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 6),
      ...formattedRide,
    };
    rides.unshift(newRide);
    writeFallbackRides(rides);
    return newRide;
  }
}

export async function acceptRide(
  rideId: string
): Promise<{ success: boolean; ride?: Ride; error?: string }> {
  if (isMongoConfigured()) {
    const db = await getDb();
    if (!ObjectId.isValid(rideId)) {
      return { success: false, error: "Ride not found" };
    }

    const target = await db.collection("rides").findOne({ _id: new ObjectId(rideId) });
    if (!target) {
      return { success: false, error: "Ride not found" };
    }

    if (target.status !== "pending") {
      return { success: false, error: "This request is no longer pending." };
    }

    // Only one active accepted ride at a time
    const activeRide = await db.collection("rides").findOne({
      _id: { $ne: new ObjectId(rideId) },
      status: "accepted",
    });

    if (activeRide) {
      return {
        success: false,
        error: "The Toto is currently assigned to another ride.",
      };
    }

    // Accept this ride
    await db.collection("rides").updateOne(
      { _id: new ObjectId(rideId) },
      { $set: { status: "accepted" } }
    );

    // Clash logic: Set all other pending rides with the exact same scheduledAt to 'clash'
    const targetNorm = normalizeScheduledAt(target.scheduledAt);
    const otherPending = await db.collection("rides").find({
      _id: { $ne: new ObjectId(rideId) },
      status: "pending",
    }).toArray();

    const clashingIds = otherPending
      .filter((r) => r.scheduledAt === target.scheduledAt || normalizeScheduledAt(r.scheduledAt) === targetNorm)
      .map((r) => r._id);

    if (clashingIds.length > 0) {
      await db.collection("rides").updateMany(
        { _id: { $in: clashingIds } },
        { $set: { status: "clash" } }
      );
    }

    const updated = await getRideById(rideId);
    return { success: true, ride: updated || undefined };
  } else {
    const rides = readFallbackRides();
    const target = rides.find((r) => r._id === rideId);
    if (!target) {
      return { success: false, error: "Ride not found" };
    }

    if (target.status !== "pending") {
      return { success: false, error: "This request is no longer pending." };
    }

    // Only one active accepted ride allowed
    const activeRide = rides.find((r) => r._id !== rideId && r.status === "accepted");
    if (activeRide) {
      return {
        success: false,
        error: "The Toto is currently assigned to another ride.",
      };
    }

    target.status = "accepted";

    // Mark other pending requests with same scheduledAt as clash
    const targetNorm = normalizeScheduledAt(target.scheduledAt);
    for (const r of rides) {
      if (
        r._id !== rideId &&
        r.status === "pending" &&
        (r.scheduledAt === target.scheduledAt || normalizeScheduledAt(r.scheduledAt) === targetNorm)
      ) {
        r.status = "clash";
      }
    }

    writeFallbackRides(rides);
    return { success: true, ride: target };
  }
}

export async function updatePassengerPickupStatus(
  rideId: string,
  identifier: { index?: number; name?: string },
  newStatus: PickupStatus
): Promise<{ success: boolean; ride?: Ride; error?: string }> {
  if (isMongoConfigured()) {
    const db = await getDb();
    if (!ObjectId.isValid(rideId)) {
      return { success: false, error: "Ride not found" };
    }

    const ride = await db.collection("rides").findOne({ _id: new ObjectId(rideId) });
    if (!ride) {
      return { success: false, error: "Ride not found" };
    }

    if (ride.status !== "accepted") {
      return {
        success: false,
        error: "Passenger status can only be updated for an active accepted ride.",
      };
    }

    const passengers: Passenger[] = ride.passengers;
    let targetIndex = -1;

    if (typeof identifier.index === "number" && identifier.index >= 0 && identifier.index < passengers.length) {
      targetIndex = identifier.index;
    } else if (identifier.name) {
      targetIndex = passengers.findIndex(
        (p) => p.name.toLowerCase() === identifier.name?.toLowerCase()
      );
    }

    if (targetIndex === -1) {
      return { success: false, error: "Passenger not found on this ride." };
    }

    passengers[targetIndex].pickupStatus = newStatus;

    await db.collection("rides").updateOne(
      { _id: new ObjectId(rideId) },
      { $set: { passengers } }
    );

    const updated = await getRideById(rideId);
    return { success: true, ride: updated || undefined };
  } else {
    const rides = readFallbackRides();
    const ride = rides.find((r) => r._id === rideId);
    if (!ride) {
      return { success: false, error: "Ride not found" };
    }

    if (ride.status !== "accepted") {
      return {
        success: false,
        error: "Passenger status can only be updated for an active accepted ride.",
      };
    }

    let targetIndex = -1;
    if (typeof identifier.index === "number" && identifier.index >= 0 && identifier.index < ride.passengers.length) {
      targetIndex = identifier.index;
    } else if (identifier.name) {
      targetIndex = ride.passengers.findIndex(
        (p) => p.name.toLowerCase() === identifier.name?.toLowerCase()
      );
    }

    if (targetIndex === -1) {
      return { success: false, error: "Passenger not found on this ride." };
    }

    ride.passengers[targetIndex].pickupStatus = newStatus;
    writeFallbackRides(rides);
    return { success: true, ride };
  }
}

export async function completeRide(
  rideId: string
): Promise<{ success: boolean; ride?: Ride; error?: string }> {
  if (isMongoConfigured()) {
    const db = await getDb();
    if (!ObjectId.isValid(rideId)) {
      return { success: false, error: "Ride not found" };
    }

    const ride = await db.collection("rides").findOne({ _id: new ObjectId(rideId) });
    if (!ride) {
      return { success: false, error: "Ride not found" };
    }

    if (ride.status !== "accepted") {
      return { success: false, error: "Only accepted rides can be completed." };
    }

    const hasPendingPassenger = (ride.passengers as Passenger[]).some(
      (p) => p.pickupStatus === "pending"
    );
    if (hasPendingPassenger) {
      return {
        success: false,
        error: "Mark every passenger as Boarded or Missed before completing the trip.",
      };
    }

    const completedAt = new Date().toISOString();
    await db.collection("rides").updateOne(
      { _id: new ObjectId(rideId) },
      { $set: { status: "completed", completedAt } }
    );

    const updated = await getRideById(rideId);
    return { success: true, ride: updated || undefined };
  } else {
    const rides = readFallbackRides();
    const ride = rides.find((r) => r._id === rideId);
    if (!ride) {
      return { success: false, error: "Ride not found" };
    }

    if (ride.status !== "accepted") {
      return { success: false, error: "Only accepted rides can be completed." };
    }

    const hasPendingPassenger = ride.passengers.some((p) => p.pickupStatus === "pending");
    if (hasPendingPassenger) {
      return {
        success: false,
        error: "Mark every passenger as Boarded or Missed before completing the trip.",
      };
    }

    ride.status = "completed";
    ride.completedAt = new Date().toISOString();
    writeFallbackRides(rides);
    return { success: true, ride };
  }
}
