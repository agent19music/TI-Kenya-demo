import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadResult = {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
};

function getRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getR2Client(): { client: S3Client; bucket: string; publicUrl: string } {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = getRequiredEnv("R2_BUCKET");
  const publicUrl = getRequiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");

  if (/r2\.cloudflarestorage\.com$/i.test(new URL(publicUrl).hostname)) {
    throw new Error("R2_PUBLIC_URL must be a public domain (for example *.r2.dev), not r2.cloudflarestorage.com.");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucket, publicUrl };
}

function sanitizeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadToR2(buffer: Buffer, fileName: string, contentType: string, folder: string): Promise<UploadResult> {
  try {
    const { client, bucket, publicUrl } = getR2Client();
    const key = `${folder}/${Date.now()}-${randomUUID()}-${sanitizeName(fileName)}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      success: true,
      key,
      url: `${publicUrl}/${key}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }
}
