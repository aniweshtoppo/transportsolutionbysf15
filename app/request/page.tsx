"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser, useSessionUser } from "@/lib/session";
import { LocationName, LOCATIONS, Ride } from "@/lib/types";

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getDefaultTimeString(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function RequestPage() {
  const router = useRouter();
  const sessionUser = useSessionUser();

  // Form states
  const [from, setFrom] = useState<LocationName>("College");
  const [to, setTo] = useState<LocationName>("Station");
  const [date, setDate] = useState(getTodayDateString);
  const [time, setTime] = useState(getDefaultTimeString);

  // Passenger input rows (each row has a name)
  const [passengers, setPassengers] = useState<string[]>(() => {
    const u = getUser();
    return u?.name ? [u.name] : [""];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // My Requests list
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);

  const fetchMyRides = useCallback((userName: string) => {
    fetch(`/api/rides?requestedBy=${encodeURIComponent(userName)}`)
      .then((res) => res.json())
      .then((data) => {
        setMyRides(data.rides || []);
        setLoadingRides(false);
      })
      .catch((e) => {
        console.error("Failed to load requests:", e);
        setLoadingRides(false);
      });
  }, []);

  // Access control & initial fetch
  useEffect(() => {
    const current = getUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    if (current.role === "rider") {
      router.replace("/rider");
      return;
    }
    fetchMyRides(current.name);
  }, [router, fetchMyRides]);


  // Passenger management handlers
  const handlePassengerChange = (index: number, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddPassenger = () => {
    setPassengers((prev) => [...prev, ""]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length <= 1) {
      setError("At least one passenger row is required.");
      return;
    }
    setError(null);
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = sessionUser || getUser();
    if (!user) return;

    setError(null);
    setSuccess(null);

    // Frontend Validations
    if (!from || !to) {
      setError("Please select both pickup and destination locations.");
      return;
    }

    if (from === to) {
      setError("Pickup (From) and Destination (To) cannot be the same.");
      return;
    }

    if (!date) {
      setError("Please select a date for the ride.");
      return;
    }

    if (!time) {
      setError("Please select a time for the ride.");
      return;
    }

    // Filter and sanitize passenger names
    const cleanedPassengers = passengers
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (cleanedPassengers.length === 0) {
      setError("Please enter at least one valid passenger name.");
      return;
    }

    // Combine date + time into ISO format: YYYY-MM-DDTHH:mm:00
    const scheduledAt = `${date}T${time}:00`;

    setLoading(true);

    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedBy: {
            name: user.name,
            role: user.role,
          },
          from,
          to,
          scheduledAt,
          passengers: cleanedPassengers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit ride request.");
      } else {
        setSuccess("Ride request created successfully!");
        // Refresh list
        fetchMyRides(user.name);
        // Reset passengers back to requester
        setPassengers([user.name]);
      }
    } catch {
      setError("Network error occurred while submitting request.");
    } finally {
      setLoading(false);
    }
  };

  const formatScheduledDate = (dtStr: string) => {
    try {
      const d = new Date(dtStr);
      return d.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dtStr.split("T")[0] || dtStr;
    }
  };

  const formatScheduledTime = (dtStr: string) => {
    try {
      const d = new Date(dtStr);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dtStr.split("T")[1] || dtStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Request Form Card */}
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-xs">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Request a Toto
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              File a trip for yourself or a group between campus locations.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Route Selection (From / To) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From
                </label>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value as LocationName)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value as LocationName)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date and Time Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Passenger Rows */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Passengers
                </label>
                <span className="text-xs text-gray-500">
                  One person files a group with every name
                </span>
              </div>

              <div className="space-y-2.5">
                {passengers.map((passengerName, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Passenger ${idx + 1} Name`}
                      value={passengerName}
                      onChange={(e) => handlePassengerChange(idx, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={idx === 0}
                    />

                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePassenger(idx)}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50 transition cursor-pointer"
                >
                  + Add Passenger
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Submitting..." : "Request Ride"}
              </button>
            </div>
          </form>
        </div>

        {/* My Requests Section */}
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              My Requests
            </h2>
            <button
              onClick={() => {
                const u = sessionUser || getUser();
                if (u) fetchMyRides(u.name);
              }}
              className="text-xs text-blue-600 hover:underline cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {loadingRides ? (
            <p className="text-sm text-gray-500">Loading requests...</p>
          ) : myRides.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg">
              No ride requests submitted yet. Use the form above to book a Toto.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myRides.map((ride) => (
                <div key={ride._id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900 text-base">
                          {ride.from} → {ride.to}
                        </span>
                        {ride.status === "pending" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {ride.status === "accepted" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            Accepted
                          </span>
                        )}
                        {ride.status === "clash" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            Clash
                          </span>
                        )}
                        {ride.status === "completed" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        {formatScheduledDate(ride.scheduledAt)} • {formatScheduledTime(ride.scheduledAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">
                      Passengers: {ride.passengers.length}
                    </span>
                    <div className="mt-1 text-gray-800">
                      {ride.passengers.map((p) => p.name).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
