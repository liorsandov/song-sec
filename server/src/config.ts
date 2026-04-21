import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT ?? "3217");
const host = process.env.HOST?.trim() || "0.0.0.0";
const soundCloudClientId = process.env.SOUNDCLOUD_CLIENT_ID?.trim() ?? "";

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a valid positive number.");
}

export const config = {
  host,
  port,
  soundCloudClientId
};
