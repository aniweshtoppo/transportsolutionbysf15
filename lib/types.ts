export type UserRole = "student" | "employee" | "rider";

export interface SessionUser {
  name: string;
  role: UserRole;
}

export type LocationName = "College" | "Station" | "Office";
export type Location = LocationName;

export const LOCATIONS: LocationName[] = ["College", "Station", "Office"];

export type RideStatus = "pending" | "accepted" | "clash" | "completed";

export type PickupStatus = "pending" | "boarded" | "missed";

export interface Passenger {
  name: string;
  pickupStatus: PickupStatus;
}

export interface Ride {
  _id?: string;
  requestedBy: {
    name: string;
    role: "student" | "employee";
  };
  from: LocationName;
  to: LocationName;
  scheduledAt: string;
  passengers: Passenger[];
  status: RideStatus;
  createdAt: string;
  completedAt?: string | null;
}
