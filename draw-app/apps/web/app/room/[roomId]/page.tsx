"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RoomRedirect() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    // Redirect to dashboard with room query param
    router.push(`/dashboard?room=${roomId}`);
  }, [roomId, router]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#a1a1aa",
      }}
    >
      Redirecting...
    </div>
  );
}
