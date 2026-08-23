import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('vaultx_token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const registerUser = async (data: any) => {
  const response = await axios.post(`${API_BASE_URL}/auth/register`, data);
  return response.data;
};

export const forgotPasswordRequest = async (data: any) => {
  const response = await axios.post(`${API_BASE_URL}/auth/forgot-password-request`, data);
  return response.data;
};

export const forgotPasswordConfirm = async (data: any) => {
  const response = await axios.post(`${API_BASE_URL}/auth/forgot-password-confirm`, data);
  return response.data;
};

export const loginStep1 = async (username: string, password: string, selectedRole: string) => {
  const response = await axios.post(`${API_BASE_URL}/auth/login-step1`, { username, password, selectedRole });
  return response.data;
};

export const verify2FA = async (tempToken: string, totpCode: string) => {
  const response = await axios.post(`${API_BASE_URL}/auth/verify-2fa`, { tempToken, totpCode });
  if (response.data.token) {
    localStorage.setItem('vaultx_token', response.data.token);
    localStorage.setItem('vaultx_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem('vaultx_token');
  localStorage.removeItem('vaultx_user');
};

export const uploadFileToVault = async (file: File, ttlMinutes: number) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ttlMinutes', ttlMinutes.toString());

  const token = localStorage.getItem('vaultx_token');
  const response = await axios.post(`${API_BASE_URL}/files/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`
    },
  });

  return response.data;
};

export const fetchFiles = async () => {
  const response = await axios.get(`${API_BASE_URL}/files`, getAuthHeaders());
  return response.data;
};

export const tamperFile = async (id: string) => {
  const response = await axios.post(`${API_BASE_URL}/files/tamper/${id}`, {}, getAuthHeaders());
  return response.data;
};

export const downloadFile = async (id: string, fileName: string) => {
  const token = localStorage.getItem('vaultx_token');
  const response = await axios.get(`${API_BASE_URL}/files/download/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const fetchAuditLogs = async () => {
  const response = await axios.get(`${API_BASE_URL}/logs`, getAuthHeaders());
  return response.data;
};