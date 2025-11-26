import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

const Verkaufskalkulation = () => {
  const navigate = useNavigate();
  const { toasts, removeToast, showInfo, showError, showSuccess } = useToast();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Listen for Ctrl+L to open admin panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setIsPasswordPromptOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAdminPasswordSubmit = async () => {
    try {
      const response = await api.post('/calculations/admin/verify', {
        password: adminPassword
      });

      if (response.data.success) {
        setShowAdminPanel(true);
        setIsPasswordPromptOpen(false);
        setAdminPassword('');
        showSuccess('Admin-Bereich freigeschaltet');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler bei der Überprüfung';
      const remainingAttempts = error.response?.data?.remainingAttempts;

      if (remainingAttempts !== undefined && remainingAttempts > 0) {
        showError(`${errorMessage} (${remainingAttempts} Versuche übrig)`);
      } else {
        showError(errorMessage);
      }
      setAdminPassword('');
    }
  };

  const handleExportDatabase = async () => {
    try {
      showInfo('Datenbank-Export wird vorbereitet...');
      const response = await api.get('/calculations/admin/export');
      const exportData = response.data;

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verkaufskalkulation_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess(`Export erfolgreich: ${exportData.summary.totalCalculations} Kalkulationen, ${exportData.summary.totalOffers} Angebote`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Fehler beim Exportieren der Datenbank');
    }
  };

  const handleShowLogs = async () => {
    try {
      setLogsLoading(true);
      setShowLogsModal(true);
      const response = await api.get('/calculations/admin/logs?limit=100');
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Logs error:', error);
      showError('Fehler beim Laden der Logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const formatLogDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      'CREATE': 'Erstellt',
      'UPDATE': 'Aktualisiert',
      'DELETE': 'Gelöscht',
      'SEND_EMAIL': 'E-Mail gesendet',
      'EXPORT': 'Exportiert'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      'CREATE': '#10b981',
      'UPDATE': '#3b82f6',
      'DELETE': '#ef4444',
      'SEND_EMAIL': '#8b5cf6',
      'EXPORT': '#f59e0b'
    };
    return colors[action] || '#6b7280';
  };

  const cards = [
    {
      icon: '📊',
      title: 'Garment-Kalkulation',
      description: 'Erstellen Sie eine neue Garment-Verkaufspreiskalkulation',
      onClick: () => navigate('/garment')
    },
    {
      icon: '📦',
      title: 'Warehousing-Kalkulation',
      description: 'Erstellen Sie eine Warehousing-Kalkulation',
      onClick: () => navigate('/warehousing')
    },
    {
      icon: '📋',
      title: 'Meine Kalkulationen',
      description: 'Alle gespeicherten Kalkulationen anzeigen',
      onClick: () => navigate('/calculations')
    },
    {
      icon: '📧',
      title: 'Meine Angebote',
      description: 'Alle erstellten Angebote anzeigen',
      onClick: () => navigate('/offers')
    }
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FHD Verkaufspreiskalkulation</h1>
          <p className="text-gray-600">Wählen Sie eine Option um zu beginnen</p>
        </div>

        {showAdminPanel && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 mb-8">
            <h3 className="text-lg font-bold text-yellow-800 mb-4">Admin-Bereich</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                className="px-4 py-2 bg-yellow-400 text-yellow-800 rounded-lg font-semibold hover:bg-yellow-500 transition"
                onClick={handleExportDatabase}
              >
                Datenbank exportieren
              </button>
              <button
                className="px-4 py-2 bg-yellow-400 text-yellow-800 rounded-lg font-semibold hover:bg-yellow-500 transition"
                onClick={handleShowLogs}
              >
                Aktivitäts-Logs
              </button>
              <button
                className="px-4 py-2 bg-yellow-400 text-yellow-800 rounded-lg font-semibold hover:bg-yellow-500 transition"
                onClick={() => setShowAdminPanel(false)}
              >
                Admin-Bereich schließen
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 shadow-md cursor-pointer border-2 border-transparent hover:border-primary-500 hover:shadow-lg hover:-translate-y-1 transition-all text-center"
              onClick={card.onClick}
            >
              <div className="text-5xl mb-4">{card.icon}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h2>
              <p className="text-gray-600">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Password Prompt Modal */}
        {isPasswordPromptOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsPasswordPromptOpen(false)}>
            <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2">Admin-Zugang</h3>
              <p className="text-gray-600 mb-4">Bitte geben Sie das Admin-Passwort ein:</p>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Passwort"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsPasswordPromptOpen(false);
                    setAdminPassword('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAdminPasswordSubmit}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Bestätigen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLogsModal(false)}>
            <div className="bg-white p-6 rounded-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Aktivitäts-Logs</h3>
              {logsLoading ? (
                <p className="text-center text-gray-500 py-8">Laden...</p>
              ) : logs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Keine Logs vorhanden</p>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={log.id || index} className="py-3 border-b border-gray-200 flex items-start gap-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                        style={{
                          backgroundColor: `${getActionColor(log.action)}20`,
                          color: getActionColor(log.action)
                        }}
                      >
                        {getActionLabel(log.action)}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">
                          {log.entity_type === 'calculation' ? 'Kalkulation' : log.entity_type === 'offer' ? 'Angebot' : log.entity_type}
                          {log.details?.kunde && ` - ${log.details.kunde}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.user_name && `von ${log.user_name} • `}
                          {formatLogDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-right">
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </Layout>
  );
};

export default Verkaufskalkulation;
