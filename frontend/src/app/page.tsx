"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>HireMind AI</h1>

      <div style={{ marginTop: "20px" }}>
        <Link href="/login">Login</Link>
      </div>
    </div>
  );
}
