// Central API configuration
// In development: defaults to http://localhost:8000
// In production: set NEXT_PUBLIC_API_URL in your Vercel env vars to your Render backend URL

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
