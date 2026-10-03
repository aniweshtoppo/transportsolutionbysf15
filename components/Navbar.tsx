"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { logoutUser, useSessionUser } from "@/lib/session";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSessionUser();

  const handleLogout = () => {
    logoutUser();
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="text-lg font-bold text-gray-900 tracking-tight hover:text-gray-700 transition"
            >
              Internal Mobility Desk
            </Link>
          </div>

          {/* Navigation Links */}
          {user && (
            <div className="flex items-center space-x-4 sm:space-x-6">
              {user.role === "rider" ? (
                <>
                  <Link
                    href="/rider"
                    className={`text-sm font-medium transition ${
                      pathname === "/rider"
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/history"
                    className={`text-sm font-medium transition ${
                      pathname === "/history"
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    History
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/request"
                    className={`text-sm font-medium transition ${
                      pathname === "/request"
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Request
                  </Link>
                  <Link
                    href="/history"
                    className={`text-sm font-medium transition ${
                      pathname === "/history"
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    History
                  </Link>
                </>
              )}

              {/* User Identity Badge */}
              <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-gray-200 text-xs">
                <span className="font-medium text-gray-700">{user.name}</span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  {user.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
