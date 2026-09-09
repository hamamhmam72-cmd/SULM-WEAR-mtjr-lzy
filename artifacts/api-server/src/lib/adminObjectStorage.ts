import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const parsePath = (value: string) => {
  const parts = value.replace(/^\/+/, "").split("/");
  if (parts.length < 2) throw new Error("Invalid object storage path");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
};

export const createProductUpload = async (_name: string, _contentType: string) => {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("Object storage is unavailable");
  const id = randomUUID();
  const fullPath = `${privateDir.replace(/\/$/, "")}/catalog/${id}`;
  const { bucketName, objectName } = parsePath(fullPath);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Could not prepare product upload");
  const data = await response.json() as { signed_url: string };
  return { uploadURL: data.signed_url, objectPath: `/api/storage/objects/catalog/${id}` };
};

export const serveProductObject = async (objectId: string, res: Response): Promise<void> => {
  if (!/^[0-9a-f-]{36}$/.test(objectId)) {
    res.status(404).end();
    return;
  }
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("Object storage is unavailable");
  const { bucketName, objectName } = parsePath(`${privateDir.replace(/\/$/, "")}/catalog/${objectId}`);
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).end();
    return;
  }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  file.createReadStream().on("error", () => res.destroy()).pipe(res);
};