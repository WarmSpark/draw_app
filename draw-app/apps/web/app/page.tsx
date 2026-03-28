"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-content">
        <h1 className="landing-title">
          Chat<span>Room</span>
        </h1>
        <p className="landing-subtitle">
          Real-time conversations, beautifully simple.
        </p>
        <div className="landing-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => router.push("/signin")}
          >
            Sign In
          </button>
          <button
            className="btn btn-outline btn-lg"
            onClick={() => router.push("/signup")}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
