import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

const OffersList = () => {
  const navigate = useNavigate();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      const response = await api.get('/calculations/offers/all');
      setOffers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading offers:', error);
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm === null) return;

    try {
      await api.delete(`/calculations/offers/${deleteConfirm}`);
      showSuccess('Angebot erfolgreich gelöscht');
      setDeleteConfirm(null);
      loadOffers();
    } catch (error) {
      console.error('Delete error:', error);
      showError('Fehler beim Löschen');
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-600'
    };

    const statusLabels = {
      pending: 'Ausstehend',
      sent: 'Gesendet',
      accepted: 'Angenommen',
      rejected: 'Abgelehnt',
      expired: 'Abgelaufen'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusStyles[status] || statusStyles.pending}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">Lädt...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
        >
          ← Zurück zur Übersicht
        </button>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Meine Angebote</h2>
        </div>

        {offers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <p className="text-lg text-gray-700 mb-2">Noch keine Angebote vorhanden.</p>
            <p className="text-gray-500">
              Erstellen Sie eine Kalkulation und generieren Sie daraus ein Angebot.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Typ</th>
                  <th className="text-left p-4 font-semibold">Erstellt am</th>
                  <th className="text-left p-4 font-semibold">Gültig bis</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-left p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {offers.map(offer => {
                  const isWarehousing = offer.offer_type === 'warehousing';
                  const typeLabel = isWarehousing ? 'Warehousing' : 'Garment';

                  return (
                    <tr key={offer.id} className="border-b border-gray-200">
                      <td className="p-4">
                        <div>
                          <strong>{offer.kunde || 'Unbenannt'}</strong>
                          {offer.customer_company && (
                            <div className="text-xs text-gray-500">{offer.customer_company}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          isWarehousing
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="p-4">{formatDate(offer.created_at)}</td>
                      <td className="p-4">{formatDate(offer.valid_until)}</td>
                      <td className="p-4">{getStatusBadge(offer.status)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => navigate(`/offers/${offer.id}`)}
                          className="px-3 py-1 mr-2 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
                        >
                          Ansehen
                        </button>
                        <button
                          onClick={() => handleDeleteClick(offer.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600"
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
            <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2">Angebot löschen?</h3>
              <p className="text-gray-600 mb-6">Möchten Sie dieses Angebot wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
                >
                  Löschen
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

export default OffersList;
