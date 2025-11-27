const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to make authenticated requests
const fetchWithAuth = async (url, options = {}) => {
  const token = getAuthToken();

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // If unauthorized, clear auth and redirect to login
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
  }

  return response;
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return response.json();
  },

  getMe: async () => {
    const response = await fetchWithAuth('/auth/me');
    return response.json();
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await fetchWithAuth('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  },
};

// Generic API helper (axios-like interface)
export const api = {
  get: async (url) => {
    const response = await fetchWithAuth(url);
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.response = { data };
      throw error;
    }
    return { data };
  },

  post: async (url, body) => {
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.response = { data };
      throw error;
    }
    return { data };
  },

  put: async (url, body) => {
    const response = await fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.response = { data };
      throw error;
    }
    return { data };
  },

  delete: async (url) => {
    const response = await fetchWithAuth(url, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.response = { data };
      throw error;
    }
    return { data };
  },

  patch: async (url, body) => {
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.response = { data };
      throw error;
    }
    return { data };
  },
};
