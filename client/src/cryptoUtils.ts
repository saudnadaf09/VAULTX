// Browser Native Web Crypto API for Zero-Trust Client-Side Encryption
export async function encryptFileClientSide(file: File): Promise<{ encryptedBlob: Blob, keyString: string }> {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  const rawKey = await window.crypto.subtle.exportKey("raw", key);
  const keyString = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  const combinedBuffer = new Uint8Array(iv.byteLength + encryptedContent.byteLength);
  combinedBuffer.set(iv, 0);
  combinedBuffer.set(new Uint8Array(encryptedContent), iv.byteLength);

  const encryptedBlob = new Blob([combinedBuffer], { type: "application/octet-stream" });
  return { encryptedBlob, keyString };
}