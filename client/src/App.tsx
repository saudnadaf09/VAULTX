import React, { useState, useEffect } from 'react';
import { loginStep1, verify2FA, registerUser, forgotPasswordRequest, forgotPasswordConfirm, logoutUser, uploadFileToVault, fetchAuditLogs, fetchFiles, downloadFile, tamperFile } from './api';
import axios from 'axios';

export function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Auth & View States: 'login' | 'register' | 'forgot-req' | 'forgot-conf' | '2fa' | 'share-download'
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-req' | 'forgot-conf' | '2fa' | 'share-download'>('login');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [regRole, setRegRole] = useState('USER');
  
  const [resetTokenInput, setResetTokenInput] = useState('');

  // 2FA States
  const [tempToken, setTempToken] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [_manualSecret, setManualSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Dashboard & Share Modal State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState<number>(2);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  // Share Modal states
  const [activeShareFileId, setActiveShareFileId] = useState<string | null>(null);
  const [sharePasswordInput, setSharePasswordInput] = useState('');
  const [generatedShareLink, setGeneratedShareLink] = useState('');

  // Recipient Shared Download States
  const [recipientShareToken, setRecipientShareToken] = useState('');
  const [recipientPassword, setRecipientPassword] = useState('');
  const [downloadingShared, setDownloadingShared] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('vaultx_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));

    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'share' && pathParts[2]) {
      setRecipientShareToken(pathParts[2]);
      setAuthView('share-download');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setResetTokenInput(urlToken);
      setAuthView('forgot-conf');
    }
  }, []);

  const refreshDashboard = async () => {
    try {
      const filesData = await fetchFiles();
      setFiles(filesData);

      const user = JSON.parse(localStorage.getItem('vaultx_user') || '{}');
      if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
        const logsData = await fetchAuditLogs();
        setLogs(logsData);
      }
    } catch (err) {
      console.error("Dashboard refresh error", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshDashboard();
      const timer = setInterval(refreshDashboard, 2000);
      return () => clearInterval(timer);
    }
  }, [currentUser]);

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const data = await loginStep1(username, password, selectedRole);
      setTempToken(data.tempToken);
      setQrCodeUrl(data.qrCodeUrl);
      setManualSecret(data.manualSecret);
      setAuthView('2fa');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Login Step 1 Failed');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const data = await verify2FA(tempToken, totpCode);
      setCurrentUser(data.user);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || '2FA Verification Failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    try {
      await registerUser({ firstName, lastName, username, email, password, role: regRole });
      setStatusMessage('Registration successful! Please login.');
      setAuthView('login');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    try {
      const data = await forgotPasswordRequest({ username, email });
      setStatusMessage(data.message);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Password recovery request failed');
    }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    try {
      await forgotPasswordConfirm({ resetToken: resetTokenInput, newPassword: password });
      setStatusMessage('Password updated securely! You can now login.');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Password reset failed');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setAuthView('login');
    setUsername('');
    setPassword('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatus('Encrypting & Uploading...');

    try {
      await uploadFileToVault(selectedFile, ttlMinutes);
      setUploadStatus(`Success: Encrypted with ${ttlMinutes}m TTL`);
      setSelectedFile(null);
      refreshDashboard();
    } catch (error: any) {
      setUploadStatus(error.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      await downloadFile(id, name);
      refreshDashboard();
    } catch (err: any) {
      alert("🚨 ZERO-TRUST ALERT: Decryption Failed or Expired!");
      refreshDashboard();
    }
  };

  const handleTamper = async (id: string) => {
    try {
      await tamperFile(id);
      refreshDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || "Tamper restricted");
    }
  };

  const handleGenerateShareLink = async (fileId: string) => {
    try {
      const token = localStorage.getItem('vaultx_token');
      const res = await axios.post(`http://localhost:5000/api/files/${fileId}/share`, {
        sharePassword: sharePasswordInput
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGeneratedShareLink(res.data.shareLink);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate share link');
    }
  };

  const handleRecipientDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setDownloadingShared(true);

    try {
      const res = await axios.post('http://localhost:5000/api/files/download-shared', {
        shareToken: recipientShareToken,
        password: recipientPassword
      }, { responseType: 'blob' });

      // Extract filename or default name
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'VaultX_Secure_File');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatusMessage('File downloaded successfully!');
    } catch (err: any) {
      setErrorMessage('Invalid password, expired link, or file purged.');
    } finally {
      setDownloadingShared(false);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#050814', backgroundImage: 'radial-gradient(circle at 50% 20%, #0f172a 0%, #050814 100%)', color: '#00ffcc', fontFamily: 'monospace', padding: '1rem' }}>
        
        {/* RECIPIENT PUBLIC SHARE DOWNLOAD VIEW (/share/:token) */}
        {authView === 'share-download' && (
          <form onSubmit={handleRecipientDownload} style={{ border: '1px solid rgba(0, 255, 204, 0.4)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.9)', width: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <h2 style={{ color: '#00ffcc', marginBottom: '0.5rem', textAlign: 'center' }}>📥 Secure Shared File</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>You have received a secure file drop. Enter the decryption password provided by the sender.</p>
            
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Decryption Password:</label>
              <input type="password" value={recipientPassword} onChange={e => setRecipientPassword(e.target.value)} placeholder="Enter password..." style={{ width: '100%', padding: '0.6rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>

            {errorMessage && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMessage}</p>}
            {statusMessage && <p style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>{statusMessage}</p>}
            
            <button type="submit" disabled={downloadingShared} style={{ width: '100%', padding: '0.75rem', background: '#00ffcc', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px', marginBottom: '1rem' }}>
              {downloadingShared ? 'Decrypting & Downloading...' : 'Download Secure File'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <span onClick={() => { window.location.href = '/'; }} style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Go to VaultX Home</span>
            </div>
          </form>
        )}

        {/* LOGIN VIEW */}
        {authView === 'login' && (
          <form onSubmit={handleLoginStep1} style={{ border: '1px solid rgba(0, 255, 204, 0.3)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.85)', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <h2 style={{ color: '#00ffcc', marginBottom: '0.5rem', textAlign: 'center' }}>🛡️ VaultX Security</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>Secure Enterprise Identity & Access Management</p>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Select Target Role:</label>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #00ffcc', color: '#00ffcc', fontWeight: 'bold', borderRadius: '6px' }}>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
                <option value="AUDITOR">AUDITOR</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Username:</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            </div>
            
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Password:</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            </div>

            {errorMessage && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMessage}</p>}
            
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#00ffcc', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px', marginBottom: '1.2rem' }}>
              Proceed to 2FA ➔
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span onClick={() => setAuthView('register')} style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>Create Account</span>
              <span onClick={() => setAuthView('forgot-req')} style={{ color: '#f59e0b', cursor: 'pointer', textDecoration: 'underline' }}>Forgot Password?</span>
            </div>
          </form>
        )}

        {/* 2FA CHALLENGE */}
        {authView === '2fa' && (
          <form onSubmit={handleVerify2FA} style={{ border: '1px solid rgba(0, 255, 204, 0.3)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.85)', width: '400px', textAlign: 'center' }}>
            <h2 style={{ color: '#00ffcc', marginBottom: '0.5rem' }}>🔐 Authenticator 2FA</h2>
            <div style={{ display: 'inline-block', padding: '10px', background: '#fff', borderRadius: '8px', margin: '1rem 0' }}>
              <img src={qrCodeUrl} alt="2FA QR Code" style={{ display: 'block', width: '140px' }} />
            </div>
            <div style={{ margin: '1rem 0', textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Enter 6-Digit TOTP Code:</label>
              <input type="text" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="123456" style={{ width: '100%', padding: '0.7rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #00ffcc', color: '#fff', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', borderRadius: '6px' }} required />
            </div>
            {errorMessage && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errorMessage}</p>}
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#00ffcc', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px' }}>Verify & Enter Vault</button>
          </form>
        )}

        {/* REGISTER */}
        {authView === 'register' && (
          <form onSubmit={handleRegister} style={{ border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.85)', width: '420px' }}>
            <h2 style={{ color: '#38bdf8', marginBottom: '0.5rem', textAlign: 'center' }}>📝 Register Account</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '0.8rem' }}>
              <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ flex: 1, padding: '0.5rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
              <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} style={{ flex: 1, padding: '0.5rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            </div>
            <select value={regRole} onChange={e => setRegRole(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.8rem', background: '#090d16', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}>
              <option value="USER">USER</option>
              <option value="AUDITOR">AUDITOR</option>
            </select>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.8rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.8rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1.2rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#38bdf8', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px' }}>Complete Registration</button>
            <span onClick={() => setAuthView('login')} style={{ display: 'block', textAlign: 'center', marginTop: '1rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Back to Login</span>
          </form>
        )}

        {/* FORGOT PASSWORD */}
        {authView === 'forgot-req' && (
          <form onSubmit={handleForgotRequest} style={{ border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.85)', width: '400px' }}>
            <h2 style={{ color: '#f59e0b', marginBottom: '0.5rem', textAlign: 'center' }}>🔑 Password Recovery</h2>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '0.9rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            <input type="email" placeholder="Registered Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '1.2rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            {statusMessage && <p style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>{statusMessage}</p>}
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#f59e0b', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px' }}>Send Reset Link to Email</button>
            <span onClick={() => setAuthView('login')} style={{ display: 'block', textAlign: 'center', marginTop: '1rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Back to Login</span>
          </form>
        )}

        {/* FORGOT CONFIRM */}
        {authView === 'forgot-conf' && (
          <form onSubmit={handleForgotConfirm} style={{ border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2.5rem', borderRadius: '12px', backgroundColor: 'rgba(17, 24, 39, 0.85)', width: '400px' }}>
            <h2 style={{ color: '#f59e0b', marginBottom: '0.5rem', textAlign: 'center' }}>🔒 Set New Password</h2>
            <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '1.2rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} required />
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#f59e0b', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', borderRadius: '6px' }}>Update Password</button>
          </form>
        )}

      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', backgroundColor: '#050814', backgroundImage: 'radial-gradient(circle at 50% 10%, #0f172a 0%, #050814 100%)', color: '#00ffcc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <h1>🛡️ VaultX | Zero-Trust Enterprise Vault</h1>
        <div style={{ border: '1px solid #334155', padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'rgba(17, 24, 39, 0.8)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>User: <strong style={{ color: '#fff' }}>{currentUser.name}</strong> | Role: <strong style={{ color: currentUser.role === 'ADMIN' ? '#ef4444' : '#10b981' }}>[{currentUser.role}]</strong></span>
          <button onClick={handleLogout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </div>

      {currentUser.role !== 'AUDITOR' && (
        <div style={{ border: '1px solid rgba(0, 255, 204, 0.3)', padding: '1.5rem', borderRadius: '10px', maxWidth: '650px', marginBottom: '2rem', backgroundColor: 'rgba(17, 24, 39, 0.7)' }}>
          <h3 style={{ marginBottom: '1rem' }}>[ Secure Upload Pipeline & Ephemeral TTL ]</h3>
          <input type="file" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} style={{ color: '#fff' }} />
          <div style={{ marginTop: '1rem' }}>
            <label>Set Auto-Expire Window (TTL): </label>
            <select value={ttlMinutes} onChange={(e) => setTtlMinutes(Number(e.target.value))} style={{ background: '#090d16', color: '#00ffcc', padding: '6px', border: '1px solid #00ffcc', borderRadius: '4px' }}>
              <option value={1}>1 Minute</option>
              <option value={2}>2 Minutes</option>
              <option value={5}>5 Minutes</option>
            </select>
          </div>
          <button onClick={handleUpload} disabled={!selectedFile || isUploading} style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', cursor: 'pointer', background: '#00ffcc', border: 'none', fontWeight: 'bold', color: '#000', borderRadius: '6px' }}>
            {isUploading ? 'Encrypting File...' : 'Encrypt & Upload'}
          </button>
          {uploadStatus && <p style={{ marginTop: '1rem', color: '#38bdf8' }}>{uploadStatus}</p>}
        </div>
      )}

      {/* STORED ASSETS TABLE */}
      <div style={{ border: '1px solid #334155', padding: '1.5rem', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.75)', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>[ Stored Ephemeral Assets ]</h3>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: '#cbd5e1' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #00ffcc', color: '#00ffcc' }}>
              <th style={{ padding: '10px' }}>File Name</th>
              <th style={{ padding: '10px' }}>Size</th>
              <th style={{ padding: '10px' }}>Uploaded By</th>
              <th style={{ padding: '10px' }}>Auto-Expires In</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '12px', color: '#94a3b8' }}>No active encrypted files in vault.</td></tr>
            ) : (
              files.map((file) => (
                <tr key={file.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px', color: '#fff' }}>{file.name}</td>
                  <td style={{ padding: '10px' }}>{file.size}</td>
                  <td style={{ padding: '10px', color: '#38bdf8' }}>{file.uploadedBy}</td>
                  <td style={{ padding: '10px', color: file.remainingSeconds < 30 ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>⏱️ {file.remainingSeconds}s</td>
                  <td style={{ padding: '10px', color: file.isTampered ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{file.isTampered ? '⚠️ TAMPERED' : '🔒 ENCRYPTED'}</td>
                  <td style={{ padding: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {currentUser.role !== 'AUDITOR' && (
                      <>
                        <button onClick={() => handleDownload(file.id, file.name)} style={{ background: '#38bdf8', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#000' }}>
                          Download
                        </button>
                        <button onClick={() => { setActiveShareFileId(file.id); setGeneratedShareLink(''); setSharePasswordInput(''); }} style={{ background: '#f59e0b', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#000' }}>
                          🔗 Share Link
                        </button>
                      </>
                    )}
                    {currentUser.role === 'ADMIN' && (
                      <button onClick={() => handleTamper(file.id)} style={{ background: '#ef4444', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#fff' }}>
                        Tamper
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SHARE MODAL */}
      {activeShareFileId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111827', border: '1px solid #f59e0b', padding: '2rem', borderRadius: '10px', width: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
            <h3 style={{ color: '#f59e0b', marginBottom: '1rem' }}>🔗 Generate Secure Share Link</h3>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>Set a decryption password for the recipient. They can download the file directly through the link within TTL.</p>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Set Password (Optional):</label>
              <input type="text" value={sharePasswordInput} onChange={e => setSharePasswordInput(e.target.value)} placeholder="e.g. Secret123" style={{ width: '100%', padding: '0.6rem', marginTop: '0.3rem', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>

            <button onClick={() => handleGenerateShareLink(activeShareFileId)} style={{ width: '100%', padding: '0.6rem', background: '#f59e0b', border: 'none', fontWeight: 'bold', color: '#000', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>
              Generate Link
            </button>

            {generatedShareLink && (
              <div style={{ marginBottom: '1rem', background: '#090d16', padding: '10px', borderRadius: '6px', border: '1px solid #00ffcc' }}>
                <p style={{ fontSize: '0.75rem', color: '#00ffcc', marginBottom: '5px' }}>Shareable URL:</p>
                <input type="text" readOnly value={generatedShareLink} style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem' }} />
                <button onClick={() => { navigator.clipboard.writeText(generatedShareLink); alert('Link copied to clipboard!'); }} style={{ marginTop: '8px', padding: '4px 8px', background: '#00ffcc', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Copy Link
                </button>
              </div>
            )}

            <button onClick={() => setActiveShareFileId(null)} style={{ width: '100%', padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* AUDIT LOGS */}
      {(currentUser.role === 'ADMIN' || currentUser.role === 'AUDITOR') && (
        <div style={{ border: '1px solid #334155', padding: '1.5rem', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.75)' }}>
          <h3 style={{ marginBottom: '1rem' }}>[ Real-Time Security Audit Logs ]</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: '#cbd5e1' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #00ffcc', color: '#00ffcc' }}>
                <th style={{ padding: '10px' }}>Log ID</th>
                <th style={{ padding: '10px' }}>Timestamp</th>
                <th style={{ padding: '10px' }}>Event Details</th>
                <th style={{ padding: '10px' }}>IP Address</th>
                <th style={{ padding: '10px' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px', color: '#f59e0b' }}>{log.id}</td>
                  <td style={{ padding: '10px' }}>{log.timestamp}</td>
                  <td style={{ padding: '10px', color: log.type === 'ALERT' ? '#ef4444' : log.type === 'WARN' ? '#f59e0b' : '#38bdf8' }}>{log.event}</td>
                  <td style={{ padding: '10px' }}>{log.userIp}</td>
                  <td style={{ padding: '10px', color: log.type === 'ALERT' ? '#ef4444' : log.type === 'WARN' ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>{log.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;