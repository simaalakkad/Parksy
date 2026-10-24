import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const secret = (() => {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required for anonymous report-device cookies.");
  return value;
})();
const cookieName = "fatih_report_device";
const signature = (id: string) => createHmac("sha256", secret).update(`cookie:${id}`).digest("base64url");
export function reportDevice(req: Request, res: Response, initialize: boolean): string | null {
  const raw = req.headers.cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const match = raw?.match(/^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
  let id = match?.[1];
  if (!match || !timingSafeEqual(Buffer.from(signature(match[1])), Buffer.from(match[2]))) {
    if (!initialize) return null;
    id = randomBytes(32).toString("base64url");
    res.cookie(cookieName, `${id}.${signature(id)}`, {
      httpOnly: true, sameSite: "lax", path: "/api", maxAge: 365 * 24 * 60 * 60_000,
      secure: req.secure || req.get("x-forwarded-proto")?.split(",")[0].trim() === "https",
    });
  }
  return createHmac("sha256", secret).update(`device:${id}`).digest("hex");
}
