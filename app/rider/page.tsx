"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getUser } from "@/lib/session";
import { Ride, PickupStatus } from "@/lib/types";

export default function RiderPage() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRides = useCallback(() => {
    fetch("/api/rides?role=rider")
      .then((res) => res.json())
      .then((data) => {
        setRides(data.rides || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load rider rides:", e);
        setLoading(false);
      });
  }, []);

  // Access control & initial data load
  useEffect(() => {
    const current = getUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    if (current.role !== "rider") {
      router.replace("/request");
      return;
    }
    fetchRides();
  }, [router, fetchRides]);

  // Handle Accept Ride
  const handleAccept = async (rideId: string) => {
    try {
      setActionLoading(`accept_${rideId}`);
      setFeedback(null);
      const res = await fetch(`/api/rides/${rideId}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Could not accept ride.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Ride accepted! Any overlapping requests for the same time are marked as Clash.",
        });
        fetchRides();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while accepting ride." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Passenger Boarded / Missed
  const handlePassengerStatus = async (
    rideId: string,
    passengerIndex: number,
    passengerName: string,
    newStatus: PickupStatus
  ) => {
    try {
      setActionLoading(`p_${rideId}_${passengerIndex}`);
      setFeedback(null);
      const res = await fetch(`/api/rides/${rideId}/passenger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerIndex,
          passengerName,
          pickupStatus: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Failed to update passenger status.",
        });
      } else {
        fetchRides();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error updating passenger status." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Complete Trip
  const handleComplete = async (ride: Ride) => {
    // Client-side quick check
    const hasPending = ride.passengers.some((p) => p.pickupStatus === "pending");
    if (hasPending) {
      setFeedback({
        type: "error",
        text: "Mark every passenger as Boarded or Missed before completing the trip.",
      });
      return;
    }

    try {
      setActionLoading(`complete_${ride._id}`);
      setFeedback(null);
      const res = await fetch(`/api/rides/${ride._id}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Failed to complete trip.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Trip completed! The Toto is now Available for new rides.",
        });
        fetchRides();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error completing trip." });
    } finally {
      setActionLoading(null);
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

  const activeRides = rides.filter((r) => r.status === "accepted");
  const pendingRides = rides.filter((r) => r.status === "pending");
  const clashRides = rides.filter((r) => r.status === "clash");
  const isTotoBusy = activeRides.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Header & Toto Status Banner */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Rider Operations Desk
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Dispatch the Toto, manage passenger boardings, and resolve same-time clashes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-xs ${
                isTotoBusy
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-emerald-50 text-emerald-900 border-emerald-300"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isTotoBusy ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span>
                Toto Status: {isTotoBusy ? "🟠 Busy" : "🟢 Available"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchRides();
              }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-sm border font-medium ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Section 1: ACTIVE / ACCEPTED RIDE */}
        {activeRides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                <span>🛺 Active Ride (In Progress)</span>
              </h2>
            </div>

            <div className="space-y-4">
              {activeRides.map((ride) => {
                const allMarked = ride.passengers.every(
                  (p) => p.pickupStatus !== "pending"
                );

                return (
                  <div
                    key={ride._id}
                    className="bg-white p-6 sm:p-7 rounded-xl border-2 border-blue-500 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-gray-100">
                      <div>
                        <div className="text-xl font-bold text-gray-900">
                          {ride.from} → {ride.to}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Scheduled:{" "}
                          <span className="font-semibold text-gray-800">
                            {formatScheduledDate(ride.scheduledAt)} • {formatScheduledTime(ride.scheduledAt)}
                          </span>{" "}
                          • Requested by:{" "}
                          <span className="font-semibold text-gray-800">
                            {ride.requestedBy.name}
                          </span>{" "}
                          <span className="capitalize text-gray-500">
                            ({ride.requestedBy.role})
                          </span>
                        </div>
                      </div>

                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full border border-blue-200">
                        Accepted
                      </span>
                    </div>

                    {/* Passenger Pickup Checklist */}
                    <div className="mt-5">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Passengers ({ride.passengers.length})
                        </div>
                        <span className="text-xs text-gray-500">
                          Mark each passenger as Boarded or Missed
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {ride.passengers.map((p, pIdx) => {
                          const isUpdating =
                            actionLoading === `p_${ride._id}_${pIdx}`;

                          return (
                            <div
                              key={pIdx}
                              className={`p-3.5 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition ${
                                p.pickupStatus === "boarded"
                                  ? "bg-emerald-50/60 border-emerald-300"
                                  : p.pickupStatus === "missed"
                                  ? "bg-red-50/60 border-red-300"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {p.name}
                                </span>
                                {p.pickupStatus === "boarded" && (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    ✅ Boarded
                                  </span>
                                )}
                                {p.pickupStatus === "missed" && (
                                  <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                    ❌ Missed
                                  </span>
                                )}
                                {p.pickupStatus === "pending" && (
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    ⏳ Pending
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    handlePassengerStatus(
                                      ride._id!,
                                      pIdx,
                                      p.name,
                                      "boarded"
                                    )
                                  }
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                    p.pickupStatus === "boarded"
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                  }`}
                                >
                                  Boarded
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    handlePassengerStatus(
                                      ride._id!,
                                      pIdx,
                                      p.name,
                                      "missed"
                                    )
                                  }
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                    p.pickupStatus === "missed"
                                      ? "bg-red-600 text-white shadow-xs"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                  }`}
                                >
                                  Missed
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Complete Trip Action Button */}
                    <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="text-xs text-gray-500">
                        {allMarked ? (
                          <span className="text-emerald-600 font-medium">
                            ✓ All passengers marked. Ready to complete trip.
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">
                            ⚠️ Please mark all passengers before completing trip.
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={actionLoading === `complete_${ride._id}`}
                        onClick={() => handleComplete(ride)}
                        className={`w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-lg shadow-xs transition cursor-pointer ${
                          allMarked
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                        }`}
                      >
                        {actionLoading === `complete_${ride._id}`
                          ? "Completing..."
                          : "Complete Trip"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 2: PENDING REQUESTS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Pending Requests ({pendingRides.length})
            </h2>
          </div>

          {loading ? (
            <div className="bg-white p-6 rounded-xl border border-gray-200 text-sm text-gray-500 text-center">
              Loading requests...
            </div>
          ) : pendingRides.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500">
              No pending ride requests.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRides.map((ride) => (
                <div
                  key={ride._id}
                  className="bg-white p-5 sm:p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-300 transition"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">
                        {ride.from} → {ride.to}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 capitalize">
                        {ride.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600">
                      Scheduled:{" "}
                      <span className="font-semibold text-gray-800">
                        {formatScheduledDate(ride.scheduledAt)} • {formatScheduledTime(ride.scheduledAt)}
                      </span>{" "}
                      • Requested by:{" "}
                      <span className="font-semibold text-gray-800">
                        {ride.requestedBy.name}
                      </span>{" "}
                      <span className="capitalize text-gray-500">
                        ({ride.requestedBy.role})
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 pt-1">
                      <span className="font-semibold text-gray-800">
                        Passengers ({ride.passengers.length}):
                      </span>{" "}
                      {ride.passengers.map((p) => p.name).join(", ")}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={
                        isTotoBusy || actionLoading === `accept_${ride._id}`
                      }
                      onClick={() => handleAccept(ride._id!)}
                      title={
                        isTotoBusy
                          ? "The Toto is currently assigned to another ride."
                          : "Accept this ride"
                      }
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {actionLoading === `accept_${ride._id}`
                        ? "Accepting..."
                        : "Accept Ride"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: CLASH REQUESTS */}
        {clashRides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <span>⚠️ Clash Requests ({clashRides.length})</span>
              </h2>
            </div>

            <div className="space-y-3">
              {clashRides.map((ride) => (
                <div
                  key={ride._id}
                  className="bg-red-50/60 p-4 rounded-xl border border-red-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-950 text-sm">
                        {ride.from} → {ride.to}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300">
                        CLASH
                      </span>
                    </div>

                    <div className="text-xs text-red-800">
                      Scheduled:{" "}
                      <span className="font-semibold">
                        {formatScheduledDate(ride.scheduledAt)} • {formatScheduledTime(ride.scheduledAt)}
                      </span>{" "}
                      • Requested by: {ride.requestedBy.name}
                    </div>

                    <div className="text-xs text-red-700">
                      Passengers: {ride.passengers.map((p) => p.name).join(", ")}
                    </div>
                  </div>

                  <div className="text-xs text-red-600 italic">
                    Same-time conflict with an accepted ride
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
