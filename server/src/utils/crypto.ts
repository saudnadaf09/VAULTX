import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto.scryptSync('VaultX_Master_Key_2026', 'salt', 32);

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  iv: string;
  authTag: string;
  sha256Hash: string;
}

export const generateSHA256 = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const encryptBuffer = (buffer: Buffer): EncryptionResult => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag().toString('hex');
  const sha256Hash = generateSHA256(buffer);

  return {
    encryptedBuffer: encrypted,
    iv: iv.toString('hex'),
    authTag,
    sha256Hash
  };
};

export const decryptBuffer = (
  encryptedBuffer: Buffer,
  ivHex: string,
  authTagHex: string
): Buffer => {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);

  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};