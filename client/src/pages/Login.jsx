import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login(null, password);

      if (result.token) {
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('authUser', JSON.stringify(result.user));
        navigate('/');
      } else {
        setError(result.error || 'Anmeldung fehlgeschlagen');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">FHD Verkaufskalkulation</h1>
          <p className="text-gray-600">Bitte melden Sie sich an</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block mb-2 text-gray-700 font-semibold">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Passwort eingeben"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 ${loading ? 'bg-gray-400' : 'bg-primary-700 hover:bg-primary-800'} text-white rounded-lg font-semibold transition`}
          >
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
