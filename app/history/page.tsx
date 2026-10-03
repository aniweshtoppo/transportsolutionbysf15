"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser, useSessionUser } from "@/lib/session";
import { Ride } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const sessionUser = useSessionUser();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback((userName: string, userRole: string) => {
    const url =
      userRole === "rider"
        ? "/api/rides?status=completed&role=rider"
        : `/api/rides?status=completed&role=${userRole}&name=${encodeURIComponent(userName)}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load ride history.");
        return res.json();
      })
      .then((data) => {
        setError(null);
        setRides(data.rides || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load history:", e);
        setError("Could not load ride history.");
        setLoading(false);
      });
  }, []);

  // Access control & data fetch
  useEffect(() => {
    const current = getUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    fetchHistory(current.name, current.role);
  }, [router, fetchHistory]);

  const currentUser = sessionUser || getUser();
  const isRider = currentUser?.role === "rider";

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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 sm:p-7 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isRider ? "Completed Trips History" : "My Trip History"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isRider
                ? "Every completed Toto trip and verified passenger boarding record."
                : `Completed trips naming ${currentUser?.name || "you"}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentUser) {
                setLoading(true);
                fetchHistory(currentUser.name, currentUser.role);
              }
            }}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
            Loading ride history...
          </div>
        ) : rides.length === 0 ? (
          /* Empty state */
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
            <p className="text-base font-medium text-gray-700">
              {isRider
                ? "No completed trips yet."
                : "No trips in your history yet."}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isRider
                ? "Accepted trips will appear here once marked as Completed."
                : "Completed trips that name you as a passenger will be recorded here."}
            </p>
          </div>
        ) : (
          /* List of History Cards */
          <div className="space-y-4">
            {rides.map((ride) => {
              // For student / employee: find their individual pickup status
              const myPassenger = ride.passengers.find(
                (p) => p.name.toLowerCase() === currentUser?.name?.toLowerCase()
              );

              return (
                <div
                  key={ride._id}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition"
                >
                  {/* Top Bar: Route & Status */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-100">
                    <div className="text-lg font-bold text-gray-900">
                      {ride.from} → {ride.to}
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Completed
                    </span>
                  </div>

                  {/* Scheduled and Completed Date/Time */}
                  <div className="mt-3 text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">
                      {formatScheduledDate(ride.scheduledAt)} • {formatScheduledTime(ride.scheduledAt)}
                    </span>
                    {ride.completedAt && (
                      <span className="ml-2 text-gray-500">
                        (Completed at {formatScheduledTime(ride.completedAt)})
                      </span>
                    )}
                  </div>

                  {/* Requested by */}
                  <div className="mt-1 text-xs text-gray-600">
                    Requested by:{" "}
                    <span className="font-medium text-gray-800">
                      {ride.requestedBy.name}
                    </span>{" "}
                    <span className="capitalize text-gray-500">
                      ({ride.requestedBy.role})
                    </span>
                  </div>

                  {/* Student / Employee Specific: Their Pickup Status */}
                  {!isRider && myPassenger && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-gray-700 font-medium">Your status:</span>
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded-full ${
                          myPassenger.pickupStatus === "boarded"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {myPassenger.pickupStatus === "boarded" ? "Boarded" : "Missed"}
                      </span>
                    </div>
                  )}

                  {/* Passengers List */}
                  <div className="mt-4 pt-3 border-t border-gray-100 text-xs">
                    <div className="font-semibold text-gray-700 mb-1.5">
                      Passengers:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ride.passengers.map((p, idx) => {
                        const isMe =
                          p.name.toLowerCase() ===
                          currentUser?.name?.toLowerCase();

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-md border flex items-center justify-between ${
                              p.pickupStatus === "boarded"
                                ? "bg-emerald-50/50 border-emerald-200"
                                : "bg-red-50/50 border-red-200"
                            } ${isMe && !isRider ? "ring-1 ring-blue-500" : ""}`}
                          >
                            <span className="font-medium text-gray-900">
                              {p.name} {isMe && !isRider && "(You)"}
                            </span>
                            <span
                              className={`font-semibold ${
                                p.pickupStatus === "boarded"
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }`}
                            >
                              {p.pickupStatus === "boarded" ? "— Boarded" : "— Missed"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
