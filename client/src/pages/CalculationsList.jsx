import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

const CalculationsList = () => {
  const navigate = useNavigate();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    loadCalculations();
  }, []);

  const loadCalculations = async () => {
    try {
      const response = await api.get('/calculations');
      setCalculations(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading calculations:', error);
      setLoading(false);
    }
  };

  const groupedCalculations = () => {
    const groups = new Map();

    calculations.forEach(calc => {
      const uuid = calc.calculation_uuid || `single-${calc.id}`;

      if (!groups.has(uuid)) {
        groups.set(uuid, {
          calculation_uuid: uuid,
          title: calc.title,
          calculation_type: calc.calculation_type || 'garment',
          versions: [],
          current: calc
        });
      }

      const group = groups.get(uuid);
      group.versions.push(calc);

      if (calc.is_current) {
        group.current = calc;
      }
    });

    groups.forEach(group => {
      group.versions.sort((a, b) => (b.version || 0) - (a.version || 0));
    });

    return Array.from(groups.values());
  };

  const toggleGroup = (uuid) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm === null) return;

    try {
      await api.delete(`/calculations/${deleteConfirm}`);
      showSuccess('Version erfolgreich gelöscht');
      setDeleteConfirm(null);
      loadCalculations();
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
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewVersion = (calc) => {
    const isWarehousing = calc.calculation_type === 'warehousing';
    const path = isWarehousing
      ? `/warehousing/${calc.id}`
      : `/garment/${calc.id}`;
    navigate(path);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">Lädt...</div>
      </Layout>
    );
  }

  const groups = groupedCalculations();

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
          <h2 className="text-2xl font-bold text-gray-900">Alle Kalkulationen</h2>
          <button
            onClick={() => navigate('/garment')}
            className="px-4 py-2 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition"
          >
            + Neue Kalkulation
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <p className="text-gray-500 mb-4">Noch keine Kalkulationen vorhanden.</p>
            <button
              onClick={() => navigate('/garment')}
              className="px-4 py-2 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition"
            >
              Erste Kalkulation erstellen
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-4 font-semibold w-12"></th>
                  <th className="text-left p-4 font-semibold">Titel</th>
                  <th className="text-left p-4 font-semibold">Typ</th>
                  <th className="text-left p-4 font-semibold">Erstellt am</th>
                  <th className="text-left p-4 font-semibold">Versionen</th>
                  <th className="text-left p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const isExpanded = expandedGroups.has(group.calculation_uuid);
                  const isWarehousing = group.calculation_type === 'warehousing';
                  const typeLabel = isWarehousing ? 'Warehousing' : 'Garment';
                  const latestVersion = group.versions[0];

                  return (
                    <React.Fragment key={group.calculation_uuid}>
                      <tr className="border-b border-gray-200 font-medium">
                        <td className="p-4">
                          <button
                            onClick={() => toggleGroup(group.calculation_uuid)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                        <td className="p-4">{group.title || 'Unbenannt'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isWarehousing
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="p-4">{formatDate(latestVersion.created_at)}</td>
                        <td className="p-4 text-gray-500">
                          {group.versions.length} {group.versions.length === 1 ? 'Version' : 'Versionen'}
                        </td>
                        <td className="p-4"></td>
                      </tr>

                      {isExpanded && group.versions.map(version => (
                        <tr key={version.id} className="bg-gray-50 border-b border-gray-200">
                          <td className="p-4"></td>
                          <td className="p-4 pl-8">
                            └─ Version {version.version || 1}
                            {version.is_current && (
                              <span className="ml-2 text-green-500 text-xs font-bold">(Aktuell)</span>
                            )}
                          </td>
                          <td className="p-4"></td>
                          <td className="p-4">{formatDate(version.created_at)}</td>
                          <td className="p-4"></td>
                          <td className="p-4">
                            <button
                              onClick={() => handleViewVersion(version)}
                              className="px-3 py-1 mr-2 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
                            >
                              Ansehen
                            </button>
                            <button
                              onClick={() => handleDeleteClick(version.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
            <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2">Version löschen?</h3>
              <p className="text-gray-600 mb-6">Möchten Sie diese Version wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
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

export default CalculationsList;
