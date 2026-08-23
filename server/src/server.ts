import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { encryptBuffer, decryptBuffer } from './utils/crypto.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'vaultx_super_secret_zero_trust_key_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: '🚨 BRUTE FORCE ALERT: IP locked due to excessive failed auth attempts.' }
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'saudnadaf854325@gmail.com',
    pass: 'YOUR_EMAIL_APP_PASSWORD'
  }
});

const USERS: Record<string, any> = {
  'saud_admin': { 
    id: '1', 
    firstName: 'Saud',
    lastName: 'Nadaf',
    username: 'saud_admin', 
    email: 'saudnadaf854325@gmail.com', 
    passwordHash: bcrypt.hashSync('Bhumika@1008', 8), 
    role: 'ADMIN',
    secret: speakeasy.generateSecret({ name: "VaultX (saud_admin)" })
  },
  'analyst_user': { 
    id: '2', 
    firstName: 'Analyst',
    lastName: 'User',
    username: 'analyst_user', 
    email: 'user@vaultx.sec', 
    passwordHash: bcrypt.hashSync('user123', 8), 
    role: 'USER',
    secret: speakeasy.generateSecret({ name: "VaultX (analyst_user)" })
  },
  'audit_officer': { 
    id: '3', 
    firstName: 'Audit',
    lastName: 'Officer',
    username: 'audit_officer', 
    email: 'auditor@vaultx.sec', 
    passwordHash: bcrypt.hashSync('auditor123', 8), 
    role: 'AUDITOR',
    secret: speakeasy.generateSecret({ name: "VaultX (audit_officer)" })
  }
};

const passwordResetTokens: Record<string, { username: string, expires: number }> = {};
const fileVault: Record<string, any> = {};
const auditLogs: any[] = [];

const activeSessions: Record<string, { username: string, role: string, ip: string, loginTime: string, token: string }> = {};
const revokedTokens: Set<string> = new Set();

// Advanced IP Geolocation & Threat Intelligence Logging
const logEvent = async (event: string, type: 'INFO' | 'WARN' | 'ALERT', ip: string, user: string = 'SYSTEM') => {
  let locationInfo = 'Local Network / Internal';
  
  const cleanIp = ip ? ip.replace(/^::ffff:/, '') : '127.0.0.1';
  if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1' && !cleanIp.startsWith('192.168.')) {
    try {
      const response = await fetch(`http://ip-api.com/json/${cleanIp}`);
      const data: any = await response.json();
      if (data.status === 'success') {
        locationInfo = `${data.country} (${data.city}) - ISP: ${data.isp}`;
      }
    } catch (e) {
      locationInfo = 'Geolocation Lookup Offline';
    }
  }

  auditLogs.unshift({
    id: `LOG-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    event: `[${user}] ${event} | Geo: ${locationInfo}`,
    userIp: cleanIp,
    type
  });
};

const sendSecurityAlertEmail = async (fileName: string, details: string) => {
  try {
    await transporter.sendMail({
      from: '"VaultX Security Sentinel" <saudnadaf854325@gmail.com>',
      to: 'saudnadaf854325@gmail.com',
      subject: `🚨 CRITICAL SECURITY ALERT: File Integrity Breach Detected!`,
      html: `
        <div style="font-family: monospace; background: #050814; color: #ff5555; padding: 20px; border-radius: 8px;">
          <h2 style="color: #ff3333;">🛡️ VaultX Threat Intelligence Monitor</h2>
          <p><b>Event:</b> Unauthorized Tampering / Integrity Breach</p>
          <p><b>Target File:</b> ${fileName}</p>
          <p><b>Action Taken:</b> ${details}</p>
          <p>System has automatically purged the payload to prevent data compromise.</p>
        </div>
      `
    });
  } catch (err) {
    console.error("Alert email dispatch failed:", err);
  }
};

setInterval(() => {
  const now = Date.now();
  Object.keys(fileVault).forEach((fileId) => {
    if (fileVault[fileId].expiresAt && now > fileVault[fileId].expiresAt) {
      const fileName = fileVault[fileId].name;
      delete fileVault[fileId];
      logEvent(`EPHEMERAL PURGE: File '${fileName}' expired`, 'WARN', 'SYSTEM', 'AUTO_CLEANUP');
    }
  });
}, 10000);

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access Denied: No Token Provided' });
  if (revokedTokens.has(token)) {
    return res.status(403).json({ error: 'Access Denied: Session has been revoked by Administrator.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Access Denied: Invalid or Expired Token' });
    req.user = user;
    req.token = token;
    next();
  });
};

const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      logEvent(`UNAUTHORIZED ACCESS ATTEMPT on ${req.originalUrl}`, 'ALERT', req.ip, req.user.username);
      return res.status(403).json({ error: `RBAC Restriction: Requires ${roles.join(' or ')} role` });
    }
    next();
  };
};

app.post('/api/auth/login-step1', authRateLimiter, async (req, res): Promise<any> => {
  const { username, password, selectedRole } = req.body;
  const user = USERS[username];

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    await logEvent(`FAILED LOGIN ATTEMPT for user: ${username}`, 'ALERT', req.ip, 'ANONYMOUS');
    return res.status(401).json({ error: 'Invalid Credentials or Username' });
  }
  if (user.role !== selectedRole) {
    await logEvent(`ROLE MISMATCH ATTEMPT: User ${username} tried logging in as ${selectedRole}`, 'ALERT', req.ip, 'ANONYMOUS');
    return res.status(403).json({ error: `Selected role does not match assigned user permission (${user.role}).` });
  }

  const qrCodeUrl = await QRCode.toDataURL(user.secret.otpauth_url || '');
  res.json({
    message: 'Primary Auth Success. 2FA Required.',
    tempToken: jwt.sign({ username: user.username, role: user.role, step: '2FA_PENDING' }, JWT_SECRET, { expiresIn: '5m' }),
    qrCodeUrl,
    manualSecret: user.secret.base32
  });
});

app.post('/api/auth/verify-2fa', authRateLimiter, async (req, res): Promise<any> => {
  const { tempToken, totpCode } = req.body;
  try {
    const decoded: any = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.step !== '2FA_PENDING') return res.status(400).json({ error: 'Invalid Auth Session' });

    const user = USERS[decoded.username];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const verified = speakeasy.totp.verify({ secret: user.secret.base32, encoding: 'base32', token: totpCode, window: 1 });
    if (!verified) {
      await logEvent(`FAILED 2FA TOTP VERIFICATION for ${decoded.username}`, 'ALERT', req.ip, decoded.username);
      return res.status(401).json({ error: 'Invalid 2FA Authenticator Code' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: `${user.firstName} ${user.lastName}` }, JWT_SECRET, { expiresIn: '2h' });
    
    activeSessions[token] = {
      username: user.username,
      role: user.role,
      ip: req.ip || '127.0.0.1',
      loginTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      token
    };

    await logEvent(`SUCCESSFUL 2FA LOGIN (Role: ${user.role})`, 'INFO', req.ip, user.username);
    res.json({ token, user: { username: user.username, role: user.role, name: `${user.firstName} ${user.lastName}` } });
  } catch (err) {
    res.status(401).json({ error: '2FA Session Expired. Please login again.' });
  }
});

app.get('/api/admin/sessions', authenticateToken, requireRole(['ADMIN']), (req: any, res: any) => {
  res.json(Object.values(activeSessions));
});

app.post('/api/admin/revoke-session', authenticateToken, requireRole(['ADMIN']), async (req: any, res: any) => {
  const { tokenToRevoke } = req.body;
  if (tokenToRevoke) {
    revokedTokens.add(tokenToRevoke);
    Object.keys(activeSessions).forEach(key => {
      if (activeSessions[key].token === tokenToRevoke) {
        delete activeSessions[key];
      }
    });
    await logEvent(`SESSION REVOKED by Administrator for token prefix: ${tokenToRevoke.substring(0, 10)}...`, 'WARN', req.ip, req.user.username);
    return res.json({ message: 'Session successfully revoked and blacklisted.' });
  }
  res.status(400).json({ error: 'Token is required.' });
});

app.post('/api/files/upload', authenticateToken, requireRole(['ADMIN', 'USER']), upload.single('file'), async (req: any, res: any): Promise<any> => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, size, buffer } = req.file;
    const ttlMinutes = req.body.ttlMinutes ? parseInt(req.body.ttlMinutes) : 10;

    const encryption = encryptBuffer(buffer);
    const fileId = Date.now().toString();
    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

    fileVault[fileId] = {
      id: fileId,
      name: originalname,
      size: `${(size / 1024 / 1024).toFixed(2)} MB`,
      hash: encryption.sha256Hash,
      encryptedData: encryption.encryptedBuffer,
      iv: encryption.iv,
      authTag: encryption.authTag,
      uploadedBy: req.user.username,
      expiresAt,
      isTampered: false,
      shareToken: null,
      sharePasswordHash: null,
      isOneTimeDownload: false
    };

    await logEvent(`Encrypted & Saved: ${originalname} (TTL: ${ttlMinutes}m)`, 'INFO', req.ip, req.user.username);
    res.json({ message: 'File encrypted successfully', file: { id: fileId, name: originalname } });
  } catch (error) {
    res.status(500).json({ error: 'Encryption failed' });
  }
});

app.post('/api/files/:id/share', authenticateToken, requireRole(['ADMIN', 'USER']), async (req: any, res: any): Promise<any> => {
  const file = fileVault[req.params.id];
  if (!file) return res.status(404).json({ error: 'File expired or not found' });

  const rawPassword = req.body.sharePassword || req.body.password;
  const isOneTime = req.body.isOneTime || false;
  const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  file.shareToken = shareToken;
  file.isOneTimeDownload = isOneTime;
  file.sharePasswordHash = (rawPassword && rawPassword.trim() !== '') ? bcrypt.hashSync(rawPassword.trim(), 8) : null;

  await logEvent(`SECURE SHARE LINK CREATED [One-Time: ${isOneTime}] for file: ${file.name}`, 'INFO', req.ip, req.user.username);
  
  const shareLink = `http://localhost:5175/share/${shareToken}`;
  res.json({ shareLink, message: 'Advanced share link generated successfully.' });
});

app.post('/api/files/download-shared', async (req, res): Promise<any> => {
  try {
    const { shareToken, password } = req.body;
    const file = Object.values(fileVault).find((f: any) => f.shareToken === shareToken);

    if (!file) {
      return res.status(404).json({ error: 'Invalid share link or file has expired / been purged.' });
    }

    if (Date.now() > file.expiresAt || file.isTampered) {
      delete fileVault[file.id];
      return res.status(400).json({ error: 'Link expired or file integrity compromised.' });
    }

    if (file.sharePasswordHash) {
      if (!password || !bcrypt.compareSync(password.trim(), file.sharePasswordHash)) {
        await logEvent(`FAILED SHARE DOWNLOAD ATTEMPT: Incorrect password`, 'ALERT', req.ip, 'RECIPIENT_OUTSIDER');
        return res.status(401).json({ error: 'Incorrect share password provided.' });
      }
    }

    const decryptedBuffer = decryptBuffer(file.encryptedData, file.iv, file.authTag);
    await logEvent(`SHARED FILE DOWNLOADED via secure link: ${file.name}`, 'WARN', req.ip, 'RECIPIENT_OUTSIDER');

    if (file.isOneTimeDownload) {
      delete fileVault[file.id];
      await logEvent(`BURN-AFTER-READING TRIGGERED: File '${file.name}' destroyed after single download.`, 'WARN', req.ip, 'AUTO_PURGE');
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(decryptedBuffer);
  } catch (err) {
    await logEvent(`CRITICAL TAMPER / DECRYPTION BREACH DETECTED during shared download`, 'ALERT', req.ip, 'RECIPIENT_OUTSIDER');
    res.status(500).json({ error: 'Decryption failed: File signature or integrity check failed!' });
  }
});

app.get('/api/files', authenticateToken, (req, res) => {
  const now = Date.now();
  const fileList = Object.values(fileVault).map(f => ({
    id: f.id,
    name: f.name,
    size: f.size,
    hash: f.hash,
    uploadedBy: f.uploadedBy,
    remainingSeconds: Math.max(0, Math.floor((f.expiresAt - now) / 1000)),
    isTampered: f.isTampered,
    hasShareLink: !!f.shareToken,
    isOneTime: f.isOneTimeDownload
  }));
  res.json(fileList);
});

app.post('/api/files/tamper/:id', authenticateToken, requireRole(['ADMIN']), async (req: any, res: any): Promise<any> => {
  const file = fileVault[req.params.id];
  if (!file) return res.status(404).json({ error: 'File not found' });
  
  file.encryptedData[0] = file.encryptedData[0] ^ 0xFF;
  file.isTampered = true;
  
  await logEvent(`INTEGRITY BREACH ALERT: Tamper simulated on file ${file.name}. Purging payload.`, 'ALERT', req.ip, req.user.username);
  await sendSecurityAlertEmail(file.name, `Payload modified maliciously. Purged from memory (Triggered by IP: ${req.ip}).`);

  delete fileVault[file.id];
  res.json({ message: 'File tampered, email alert dispatched, and automatically purged by security monitor.' });
});

app.get('/api/logs', authenticateToken, requireRole(['ADMIN', 'AUDITOR']), (req: any, res: any) => {
  res.json(auditLogs);
});

app.listen(PORT, () => console.log(`🛡️ VaultX Enterprise IAM & Geolocation Intel running on http://localhost:5000`));