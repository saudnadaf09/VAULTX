# 🛡️ VAULTX — Enterprise Zero-Trust Node.js & React Architecture

> **VAULTX** is a high-security, Zero-Trust web application designed with an end-to-end encrypted vault infrastructure, strict Role-Based Access Control (RBAC), multi-factor authentication (2FA TOTP), and real-time active session revocation.

---

## 🏗️ System Architecture

VAULTX is built on a decoupled, secure-by-design architecture:
- **Backend Core**: Node.js, Express, TypeScript, Web Crypto API, JWT-based ephemeral tokens, and strict session management middleware.
- **Frontend Client**: React 18, Vite, TypeScript, Tailwind CSS / responsive design, and client-side AES-GCM cryptography module.
- **Security & IAM**: Granular RBAC permissions, time-based one-time passwords (TOTP), IP telemetry audit logging, and automated threat detection headers.

---

## 🚀 Key Security Features

1. **Zero-Trust Access Control**: Implicitly trusts nothing; verifies every identity, device, and request context explicitly.
2. **Client-Side Cryptography**: Utilizes the native Web Crypto API for secure browser-side AES-GCM payload encryption before transit.
3. **Active Session Revocation**: Real-time token blacklisting and instant revocation mechanisms for compromised sessions.
4. **Comprehensive Telemetry & Audit Logs**: Immutable system logs capturing all access events, security violations, and cryptographic handshakes.

---

## 🛠️ Getting Started & Local Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 1. Clone the Repository
```bash
git clone [https://github.com/saudnadaf09/VAULTX.git](https://github.com/saudnadaf09/VAULTX.git)
cd VAULTX