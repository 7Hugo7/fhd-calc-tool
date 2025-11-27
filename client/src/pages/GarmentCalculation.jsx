import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import OfferModal from '../components/OfferModal';
import Toast from '../components/Toast';

// Helper function for currency formatting
const formatCurrency = (value, currency = 'EUR') => {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num)) return currency === 'EUR' ? '0,00 €' : '$ 0.00';

  const formatted = num.toFixed(2).replace('.', ',');
  return currency === 'EUR' ? `${formatted} €` : `$ ${formatted.replace(',', '.')}`;
};

const GarmentCalculation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [calculationId, setCalculationId] = useState(id ? parseInt(id) : null);
  const [calculationUuid, setCalculationUuid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [items, setItems] = useState([{
    item_number: 1,
    fob_preis_usd: '',
    kurs: '1,0000',
    fob_preis_eur: '',
    fracht: '',
    zoll_prozent: '12',
    zoll: '',
    aufbereitung: '',
    selbstkosten: '',
    fhd_aufschlag_prozent: '',
    fhd_aufschlag_wert: '',
    vk_roh: '',
    vk_gesetzt: '',
    provision_agent_prozent: '',
    provision_agent_wert: '',
    marge_real: '',
    style: '',
    composition: '',
    material: '',
    lieferant: '',
    lieferung: '',
    lieferzeit: '',
    produktionszeitraum: '',
    frachtzeitraum: '',
    luftfrachtzuschlag: '',
    gg: '',
    bemerkungen: ''
  }]);

  // Load existing calculation if ID is present
  useEffect(() => {
    if (id) {
      loadCalculation(parseInt(id));
    }
  }, [id]);

  const loadCalculation = async (calcId) => {
    try {
      setLoading(true);
      const response = await api.get(`/calculations/${calcId}`);
      const data = response.data;

      if (data.calculation_uuid) {
        setCalculationUuid(data.calculation_uuid);
      }

      if (data.items && data.items.length > 0) {
        // Helper to format numeric values with 2 decimal places (4 for kurs)
        const formatNum = (val, decimals = 2) => {
          if (val == null || val === '') return '';
          const num = parseFloat(val);
          return !isNaN(num) ? num.toFixed(decimals).replace('.', ',') : '';
        };

        const loadedItems = data.items.map((item, index) => ({
          item_number: item.item_number || index + 1,
          fob_preis_usd: formatNum(item.fob_preis_usd),
          kurs: formatNum(item.kurs, 4) || '1,0000',
          fob_preis_eur: formatNum(item.fob_preis_eur),
          fracht: formatNum(item.fracht),
          zoll_prozent: formatNum(item.zoll_prozent),
          zoll: formatNum(item.zoll),
          aufbereitung: formatNum(item.aufbereitung),
          selbstkosten: formatNum(item.selbstkosten),
          fhd_aufschlag_prozent: formatNum(item.fhd_aufschlag_prozent),
          fhd_aufschlag_wert: formatNum(item.fhd_aufschlag_wert),
          vk_roh: formatNum(item.vk_roh),
          vk_gesetzt: formatNum(item.vk_gesetzt),
          provision_agent_prozent: formatNum(item.provision_agent_prozent),
          provision_agent_wert: formatNum(item.provision_agent_wert),
          marge_real: formatNum(item.marge_real),
          style: item.style || '',
          composition: item.composition || '',
          material: item.material || '',
          lieferant: item.lieferant || '',
          lieferung: item.lieferung || '',
          lieferzeit: item.lieferzeit || '',
          produktionszeitraum: item.produktionszeitraum || '',
          frachtzeitraum: item.frachtzeitraum || '',
          luftfrachtzuschlag: formatNum(item.luftfrachtzuschlag),
          gg: item.gg || '',
          bemerkungen: item.bemerkungen || ''
        }));
        setItems(loadedItems);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading calculation:', error);
      showError('Fehler beim Laden der Kalkulation');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const kunde = items[0]?.style;

    if (!kunde || !kunde.trim()) {
      showWarning('Bitte Style/Bezeichnung eingeben');
      return;
    }

    setSaving(true);
    try {
      let response;

      if (calculationId) {
        // UPDATE - creates a new version
        response = await api.put(`/calculations/${calculationId}`, {
          kunde,
          items,
          calculation_type: 'garment'
        });

        if (response.data && response.data.id) {
          setCalculationId(response.data.id);
          if (response.data.calculation_uuid) {
            setCalculationUuid(response.data.calculation_uuid);
          }
          showSuccess(`Neue Version ${response.data.version || ''} erstellt!`);
          navigate(`/garment/${response.data.id}`);
        }
      } else {
        // CREATE new
        response = await api.post('/calculations', {
          kunde,
          items,
          calculation_type: 'garment'
        });

        if (response.data && response.data.id) {
          setCalculationId(response.data.id);
          if (response.data.calculation_uuid) {
            setCalculationUuid(response.data.calculation_uuid);
          }
          showSuccess('Kalkulation erfolgreich gespeichert!');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      showError('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOffer = async (offerData) => {
    try {
      const kunde = items[0]?.style;

      if (!kunde || !kunde.trim()) {
        showWarning('Bitte Style/Bezeichnung eingeben');
        return;
      }

      const response = await api.post('/calculations/offers', {
        ...offerData,
        kunde,
        items,
        offer_type: 'garment',
        source_calculation_id: calculationId
      });

      if (response.data && response.data.id) {
        showSuccess('Angebot erfolgreich erstellt!');
        setShowOfferModal(false);
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      showError('Fehler beim Erstellen des Angebots');
    }
  };

  const calculateItem = (index) => {
    const item = items[index];

    try {
      const fobUsd = parseFloat(item.fob_preis_usd.replace(',', '.')) || 0;
      const kurs = parseFloat(item.kurs.replace(',', '.')) || 1;
      const fracht = parseFloat(item.fracht.replace(',', '.')) || 0;
      const zollProzent = parseFloat(item.zoll_prozent.replace(',', '.')) || 0;
      const aufbereitung = parseFloat(item.aufbereitung.replace(',', '.')) || 0;
      const fhdAufschlagProzent = parseFloat(item.fhd_aufschlag_prozent.replace(',', '.')) || 0;

      const fobEur = fobUsd * kurs;
      const zoll = fobEur * (zollProzent / 100);
      const selbstkosten = fobEur + fracht + zoll + aufbereitung;
      const fhdAufschlagWert = selbstkosten * (fhdAufschlagProzent / 100);
      const vkRoh = selbstkosten + fhdAufschlagWert;

      const newItems = [...items];
      newItems[index] = {
        ...item,
        fob_preis_eur: fobEur.toFixed(2).replace('.', ','),
        zoll: zoll.toFixed(2).replace('.', ','),
        selbstkosten: selbstkosten.toFixed(2).replace('.', ','),
        fhd_aufschlag_wert: fhdAufschlagWert.toFixed(2).replace('.', ','),
        vk_roh: vkRoh.toFixed(2).replace('.', ',')
      };
      setItems(newItems);

      // Calculate extra fields
      setTimeout(() => calculateExtraFields(index, newItems[index]), 0);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  const calculateExtraFields = (index, updatedItem) => {
    const vkSet = parseFloat(updatedItem.vk_gesetzt.replace(',', '.')) || 0;
    const provisionProzent = parseFloat(updatedItem.provision_agent_prozent.replace(',', '.')) || 0;
    const provisionWert = vkSet * (provisionProzent / 100);

    const selbstkosten = parseFloat(updatedItem.selbstkosten.replace(',', '.')) || 0;
    const margeReal = vkSet - selbstkosten - provisionWert;

    const newItems = [...items];
    newItems[index] = {
      ...updatedItem,
      provision_agent_wert: provisionWert.toFixed(2).replace('.', ','),
      marge_real: margeReal.toFixed(2).replace('.', ',')
    };

    setItems(newItems);
  };

  const handleInputChange = (index, field, value) => {
    const numericFields = [
      'fob_preis_usd', 'kurs', 'fob_preis_eur', 'fracht', 'zoll_prozent', 'zoll',
      'aufbereitung', 'selbstkosten', 'fhd_aufschlag_prozent', 'fhd_aufschlag_wert',
      'vk_roh', 'vk_gesetzt', 'provision_agent_prozent', 'provision_agent_wert',
      'marge_real', 'luftfrachtzuschlag'
    ];

    let filteredValue = value;
    if (numericFields.includes(field)) {
      filteredValue = value.replace(/[^0-9,.-]/g, '');
      const commaCount = (filteredValue.match(/,/g) || []).length;
      const periodCount = (filteredValue.match(/\./g) || []).length;
      if (commaCount > 1) {
        filteredValue = filteredValue.replace(/,([^,]*)$/, '$1');
      }
      if (periodCount > 1) {
        filteredValue = filteredValue.replace(/\.([^.]*)$/, '$1');
      }
    }

    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: filteredValue };
    setItems(newItems);
  };

  const handleNumericBlur = (index, field) => {
    const item = items[index];
    const value = item[field];

    if (value && value.trim() !== '') {
      const num = parseFloat(value.replace(',', '.'));
      if (!isNaN(num)) {
        const formatted = field === 'kurs'
          ? num.toFixed(4).replace('.', ',')
          : num.toFixed(2).replace('.', ',');
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: formatted };
        setItems(newItems);
      }
    }

    calculateItem(index);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const formElements = document.querySelectorAll(
        'input:not([readonly]):not([type="button"]), textarea'
      );
      const currentIndex = Array.from(formElements).indexOf(e.currentTarget);
      if (currentIndex > -1 && currentIndex < formElements.length - 1) {
        formElements[currentIndex + 1].focus();
      }
    }
  };

  const addItem = () => {
    if (items.length < 10) {
      setItems([...items, {
        item_number: items.length + 1,
        fob_preis_usd: '',
        kurs: '1,0000',
        fob_preis_eur: '',
        fracht: '',
        zoll_prozent: '12',
        zoll: '',
        aufbereitung: '',
        selbstkosten: '',
        fhd_aufschlag_prozent: '',
        fhd_aufschlag_wert: '',
        vk_roh: '',
        vk_gesetzt: '',
        provision_agent_prozent: '',
        provision_agent_wert: '',
        marge_real: '',
        style: '',
        composition: '',
        material: '',
        lieferant: '',
        lieferung: '',
        lieferzeit: '',
        produktionszeitraum: '',
        frachtzeitraum: '',
        luftfrachtzuschlag: '',
        gg: '',
        bemerkungen: ''
      }]);
    }
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index).map((item, i) => ({
        ...item,
        item_number: i + 1
      }));
      setItems(newItems);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const PDFGenerator = (await import('../utils/pdfGenerator')).default;
      const pdf = new PDFGenerator();

      await pdf.loadLogo('/fhd_logo.png');
      pdf.addLogo(40);

      const today = new Date().toLocaleDateString('de-DE');
      const kunde = items[0]?.style || 'Kalkulation';

      pdf.addFullHeader({ date: today });
      pdf.addDocumentTitle('PREISKALKULATION');

      const fmt = (val, suffix = ' EUR') => {
        if (!val && val !== 0) return '-';
        const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
        if (isNaN(num)) return String(val);
        return num.toFixed(2).replace('.', ',') + suffix;
      };

      items.forEach((item, index) => {
        const sectionItems = [];
        if (item.composition) sectionItems.push({ description: 'Zusammensetzung', value: item.composition });
        if (item.gg) sectionItems.push({ description: 'GG', value: item.gg });
        if (item.material) sectionItems.push({ description: 'Material', value: item.material });
        if (item.lieferant) sectionItems.push({ description: 'Lieferant', value: item.lieferant });
        if (item.lieferung) sectionItems.push({ description: 'Lieferung', value: item.lieferung });
        if (item.lieferzeit) sectionItems.push({ description: 'Lieferzeit', value: item.lieferzeit });
        if (item.produktionszeitraum) sectionItems.push({ description: 'Produktionszeitraum', value: item.produktionszeitraum });
        if (item.frachtzeitraum) sectionItems.push({ description: 'Frachtzeitraum', value: item.frachtzeitraum });
        sectionItems.push({ description: 'FOB Preis (USD)', value: fmt(item.fob_preis_usd, ' USD') });
        sectionItems.push({ description: 'Wechselkurs', value: item.kurs || '-' });
        sectionItems.push({ description: 'FOB Preis (EUR)', value: fmt(item.fob_preis_eur) });
        sectionItems.push({ description: 'Fracht', value: fmt(item.fracht) });
        sectionItems.push({ description: 'Zoll (%)', value: item.zoll_prozent ? item.zoll_prozent + ' %' : '-' });
        sectionItems.push({ description: 'Zoll (EUR)', value: fmt(item.zoll) });
        sectionItems.push({ description: 'Aufbereitung', value: fmt(item.aufbereitung) });
        sectionItems.push({ description: 'Selbstkosten', value: fmt(item.selbstkosten), highlight: true });
        sectionItems.push({ description: 'FHD Aufschlag (%)', value: item.fhd_aufschlag_prozent ? item.fhd_aufschlag_prozent + ' %' : '-' });
        sectionItems.push({ description: 'FHD Aufschlag (EUR)', value: fmt(item.fhd_aufschlag_wert) });
        sectionItems.push({ description: 'VK Roh', value: fmt(item.vk_roh) });
        sectionItems.push({ description: 'VK Gesetzt', value: fmt(item.vk_gesetzt), highlight: true });
        sectionItems.push({ description: 'Provision Agent (%)', value: item.provision_agent_prozent ? item.provision_agent_prozent + ' %' : '-' });
        sectionItems.push({ description: 'Provision Agent (EUR)', value: fmt(item.provision_agent_wert) });
        sectionItems.push({ description: 'Marge Real', value: fmt(item.marge_real), highlight: true });
        if (item.luftfrachtzuschlag || item.luftfrachtzuschlag === 0) sectionItems.push({ description: 'Luftfracht Zuschlag', value: fmt(item.luftfrachtzuschlag) });
        if (item.bemerkungen) sectionItems.push({ description: 'Bemerkungen', value: item.bemerkungen });

        pdf.addSection({
          title: `Position ${item.item_number || index + 1}: ${item.style || 'Unbenannt'}`,
          items: sectionItems
        });
      });

      pdf.addLegalNotes([
        'Alle Preise verstehen sich zuzüglich MwSt.',
        'Diese Kalkulation dient nur zu Informationszwecken.'
      ]);

      pdf.addSimpleFooter('Fashion Holding Düsseldorf GmbH | www.fhd.agency');

      pdf.save(`Kalkulation_${kunde || 'Unbenannt'}_${new Date().toISOString().slice(0,10)}.pdf`);
      showSuccess('PDF erfolgreich erstellt!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showError('Fehler bei der PDF-Generierung');
    }
  };

  const handleReset = () => {
    setItems([{
      item_number: 1,
      fob_preis_usd: '',
      kurs: '1,0000',
      fob_preis_eur: '',
      fracht: '',
      zoll_prozent: '12',
      zoll: '',
      aufbereitung: '',
      selbstkosten: '',
      fhd_aufschlag_prozent: '',
      fhd_aufschlag_wert: '',
      vk_roh: '',
      vk_gesetzt: '',
      provision_agent_prozent: '',
      provision_agent_wert: '',
      marge_real: '',
      style: '',
      composition: '',
      material: '',
      lieferant: '',
      lieferung: '',
      lieferzeit: '',
      produktionszeitraum: '',
      frachtzeitraum: '',
      luftfrachtzuschlag: '',
      gg: '',
      bemerkungen: ''
    }]);
    showSuccess('Kalkulation zurückgesetzt');
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
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition flex items-center gap-2"
        >
          ← Zurück zur Übersicht
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Garment-Kalkulation</h1>
        <p className="text-gray-600 mb-8">
          Berechnen Sie Verkaufspreise mit allen relevanten Kostenfaktoren.
        </p>

        {items.map((item, index) => (
          <div key={index} className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Position {index + 1}</h2>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">Style: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={item.style}
                    onChange={(e) => handleInputChange(index, 'style', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Bezeichnung (Pflichtfeld)"
                    className={`w-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${!item.style ? 'border-red-300' : 'border-gray-300'}`}
                    required
                  />
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Einkauf Column */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide pb-2 border-b-2 border-blue-500">Einkauf</div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">FOB Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      value={item.fob_preis_usd}
                      onChange={(e) => handleInputChange(index, 'fob_preis_usd', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'fob_preis_usd')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Wechselkurs</label>
                  <input
                    type="text"
                    value={item.kurs}
                    onChange={(e) => handleInputChange(index, 'kurs', e.target.value)}
                    onBlur={() => handleNumericBlur(index, 'kurs')}
                    onKeyDown={handleKeyDown}
                    placeholder="1,0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">FOB Preis (EUR)</label>
                  <input
                    type="text"
                    value={item.fob_preis_eur ? formatCurrency(item.fob_preis_eur) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                    placeholder="0,00 €"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Fracht</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.fracht}
                      onChange={(e) => handleInputChange(index, 'fracht', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'fracht')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>
              </div>

              {/* Kosten & Zoll Column */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide pb-2 border-b-2 border-blue-500">Kosten & Zoll</div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Zoll (%)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.zoll_prozent}
                      onChange={(e) => handleInputChange(index, 'zoll_prozent', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'zoll_prozent')}
                      onKeyDown={handleKeyDown}
                      placeholder="12,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Zollwert</label>
                  <input
                    type="text"
                    value={item.zoll ? formatCurrency(item.zoll) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                    placeholder="0,00 €"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Aufbereitung</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.aufbereitung}
                      onChange={(e) => handleInputChange(index, 'aufbereitung', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'aufbereitung')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Selbstkosten</label>
                  <input
                    type="text"
                    value={item.selbstkosten ? formatCurrency(item.selbstkosten) : ''}
                    readOnly
                    className="w-full px-3 py-2 border-2 border-green-500 rounded-lg bg-green-100 text-green-800 font-bold"
                    placeholder="0,00 €"
                  />
                </div>
              </div>

              {/* Verkauf Column */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide pb-2 border-b-2 border-blue-500">Verkauf</div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">FHD Aufschlag (%)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.fhd_aufschlag_prozent}
                      onChange={(e) => handleInputChange(index, 'fhd_aufschlag_prozent', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'fhd_aufschlag_prozent')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">FHD Aufschlag (EUR)</label>
                  <input
                    type="text"
                    value={item.fhd_aufschlag_wert ? formatCurrency(item.fhd_aufschlag_wert) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                    placeholder="0,00 €"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">VK roh</label>
                  <input
                    type="text"
                    value={item.vk_roh ? formatCurrency(item.vk_roh) : ''}
                    readOnly
                    className="w-full px-3 py-2 border-2 border-green-500 rounded-lg bg-green-100 text-green-800 font-bold"
                    placeholder="0,00 €"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">VK set</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.vk_gesetzt}
                      onChange={(e) => handleInputChange(index, 'vk_gesetzt', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'vk_gesetzt')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Provision Agent (%)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.provision_agent_prozent}
                      onChange={(e) => handleInputChange(index, 'provision_agent_prozent', e.target.value)}
                      onBlur={() => handleNumericBlur(index, 'provision_agent_prozent')}
                      onKeyDown={handleKeyDown}
                      placeholder="0,00"
                      className="w-full px-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Provision Agent (EUR)</label>
                  <input
                    type="text"
                    value={item.provision_agent_wert ? formatCurrency(item.provision_agent_wert) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                    placeholder="0,00 €"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Marge Real</label>
                  <input
                    type="text"
                    value={item.marge_real ? formatCurrency(item.marge_real) : ''}
                    readOnly
                    className="w-full px-3 py-2 border-2 border-green-500 rounded-lg bg-green-100 text-green-800 font-bold"
                    placeholder="0,00 €"
                  />
                </div>
              </div>

              {/* Zusätzliche Infos Column */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide pb-2 border-b-2 border-blue-500">Zusätzliche Infos</div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Zusammensetzung</label>
                  <input
                    type="text"
                    value={item.composition}
                    onChange={(e) => handleInputChange(index, 'composition', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Zusammensetzung"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Material</label>
                  <input
                    type="text"
                    value={item.material}
                    onChange={(e) => handleInputChange(index, 'material', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Material"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Lieferant</label>
                  <input
                    type="text"
                    value={item.lieferant}
                    onChange={(e) => handleInputChange(index, 'lieferant', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Lieferant"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Lieferung</label>
                  <input
                    type="text"
                    value={item.lieferung}
                    onChange={(e) => handleInputChange(index, 'lieferung', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Lieferung"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">GG</label>
                  <input
                    type="text"
                    value={item.gg}
                    onChange={(e) => handleInputChange(index, 'gg', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="GG"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-gray-700 font-semibold text-sm">Bemerkungen</label>
                  <textarea
                    value={item.bemerkungen}
                    onChange={(e) => handleInputChange(index, 'bemerkungen', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Bemerkungen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[60px]"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-4 justify-center flex-wrap mt-6">
          {items.length < 10 && (
            <button
              onClick={addItem}
              className="px-6 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition"
            >
              + Position hinzufügen
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            disabled={saving}
          >
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
          <button
            onClick={handleGeneratePDF}
            className="px-6 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition"
          >
            PDF generieren
          </button>
          <button
            onClick={() => setShowOfferModal(true)}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition"
          >
            Angebot erstellen
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
          >
            Zurücksetzen
          </button>
        </div>

        <OfferModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          onSubmit={handleCreateOffer}
          calculationType="garment"
        />
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </Layout>
  );
};

export default GarmentCalculation;
