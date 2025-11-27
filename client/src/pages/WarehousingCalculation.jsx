import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import OfferModal from '../components/OfferModal';
import Toast from '../components/Toast';

const WarehousingCalculation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [calculationId, setCalculationId] = useState(id ? parseInt(id) : null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [kunde, setKunde] = useState('');

  const [warehousing, setWarehousing] = useState({
    handling_in_entladung: '',
    lagerplatz_verbringen: '',
    kommissionierung_b2b: '',
    kommissionierung_b2c: '',
    zusatzarbeiten_stunden: '',
    handling_out: '',
    anmeldung_avisierung: '',
    lieferscheintasche: '',
    kartonage1_text: '',
    kartonage1_wert: '',
    kartonage2_text: '',
    kartonage2_wert: '',
    kartonage3_text: '',
    kartonage3_wert: '',
    annahme_entsorgung: '',
    grobsichtung: '',
    einhuellen_polybag: '',
    rueckfuehrung_bestand: '',
    flaeche_m2: '',
    preis_m2: '',
    inventur_stunden: '',
    etiketten_drucken_stunden: '',
    etikettierung_stunden: '',
    bemerkungen: ''
  });

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

      if (data.kunde) {
        setKunde(data.kunde);
      }

      if (data.warehousing) {
        // Fields that should be formatted as numbers with 2 decimal places
        const numericFields = [
          'handling_in_entladung', 'lagerplatz_verbringen', 'kommissionierung_b2b',
          'kommissionierung_b2c', 'zusatzarbeiten_stunden', 'handling_out',
          'anmeldung_avisierung', 'lieferscheintasche', 'kartonage1_wert',
          'kartonage2_wert', 'kartonage3_wert', 'annahme_entsorgung', 'grobsichtung',
          'einhuellen_polybag', 'rueckfuehrung_bestand', 'preis_m2',
          'inventur_stunden', 'etiketten_drucken_stunden', 'etikettierung_stunden'
        ];

        const formatValue = (key, value) => {
          if (value == null || value === '') return '';
          if (numericFields.includes(key)) {
            const num = parseFloat(value);
            return !isNaN(num) ? num.toFixed(2).replace('.', ',') : value.toString();
          }
          return value.toString();
        };

        setWarehousing({
          ...warehousing,
          ...Object.fromEntries(
            Object.entries(data.warehousing).map(([key, value]) => [
              key,
              formatValue(key, value)
            ])
          )
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading calculation:', error);
      showError('Fehler beim Laden der Kalkulation');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!kunde.trim()) {
      showWarning('Bitte Kundenname eingeben');
      return;
    }

    setSaving(true);
    try {
      let response;

      if (calculationId) {
        response = await api.put(`/calculations/${calculationId}`, {
          kunde,
          warehousing,
          calculation_type: 'warehousing'
        });

        if (response.data && response.data.id) {
          setCalculationId(response.data.id);
          showSuccess(`Neue Version ${response.data.version || ''} erstellt!`);
          navigate(`/warehousing/${response.data.id}`);
        }
      } else {
        response = await api.post('/calculations', {
          kunde,
          warehousing,
          calculation_type: 'warehousing'
        });

        if (response.data && response.data.id) {
          setCalculationId(response.data.id);
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
      const response = await api.post('/calculations/offers', {
        ...offerData,
        kunde,
        warehousing,
        offer_type: 'warehousing',
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

  const handleInputChange = (field, value) => {
    setWarehousing(prev => ({ ...prev, [field]: value }));
  };

  const handleNumericBlur = (field) => {
    const value = warehousing[field];
    if (value && value.trim() !== '') {
      const num = parseFloat(value.replace(',', '.'));
      if (!isNaN(num)) {
        const formatted = num.toFixed(2).replace('.', ',');
        setWarehousing(prev => ({ ...prev, [field]: formatted }));
      }
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const PDFGenerator = (await import('../utils/pdfGenerator')).default;
      const pdf = new PDFGenerator();

      await pdf.loadLogo('/fhd_logo.png');
      pdf.addLogo(35);

      const today = new Date().toLocaleDateString('de-DE');
      const kundenName = kunde || 'Warehousing';

      pdf.addCompactHeader({ date: today });
      pdf.addDocumentTitle(`Angebot: ${kundenName}`);

      const fmt = (val, suffix = ' €') => {
        if (!val && val !== 0) return '-';
        const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
        if (isNaN(num)) return String(val);
        return num.toFixed(2).replace('.', ',') + suffix;
      };

      // Bereich 1: Wareneingang & Warenausgang
      const section1Items = [];
      if (warehousing.handling_in_entladung) section1Items.push({ description: 'Handling in / Entladung', value: fmt(warehousing.handling_in_entladung) });
      if (warehousing.lagerplatz_verbringen) section1Items.push({ description: 'Lagerplatz verbringen', value: fmt(warehousing.lagerplatz_verbringen) });
      if (warehousing.kommissionierung_b2b) section1Items.push({ description: 'Kommissionierung B2B', value: fmt(warehousing.kommissionierung_b2b) });
      if (warehousing.kommissionierung_b2c) section1Items.push({ description: 'Kommissionierung B2C', value: fmt(warehousing.kommissionierung_b2c) });
      if (warehousing.handling_out) section1Items.push({ description: 'Handling out', value: fmt(warehousing.handling_out) });

      // Bereich 2: Retouren & Lager & Sonderarbeiten
      const section2Items = [];
      if (warehousing.anmeldung_avisierung) section2Items.push({ description: 'Avisierung Großkunde', value: fmt(warehousing.anmeldung_avisierung) });
      if (warehousing.zusatzarbeiten_stunden) section2Items.push({ description: 'Zusatzarbeiten (Inventur - Etikettierung - tec.) Stundenbasis', value: fmt(warehousing.zusatzarbeiten_stunden) });
      if (warehousing.annahme_entsorgung) section2Items.push({ description: 'Annahme / Entsorgung Material', value: fmt(warehousing.annahme_entsorgung) });
      if (warehousing.grobsichtung) section2Items.push({ description: 'Grobsichtung', value: fmt(warehousing.grobsichtung) });
      if (warehousing.einhuellen_polybag) section2Items.push({ description: 'Neuverpackung in Single polybag', value: fmt(warehousing.einhuellen_polybag) });
      if (warehousing.rueckfuehrung_bestand) section2Items.push({ description: 'Lagerplatz verbringen', value: fmt(warehousing.rueckfuehrung_bestand) });
      if (warehousing.flaeche_m2) section2Items.push({ description: 'Fläche', value: warehousing.flaeche_m2 + ' m²' });
      if (warehousing.preis_m2) section2Items.push({ description: 'Preis pro m²', value: fmt(warehousing.preis_m2) });
      if (warehousing.inventur_stunden) section2Items.push({ description: 'Inventur (Std.)', value: fmt(warehousing.inventur_stunden) });
      if (warehousing.etiketten_drucken_stunden) section2Items.push({ description: 'Etiketten drucken (Std.)', value: fmt(warehousing.etiketten_drucken_stunden) });
      if (warehousing.etikettierung_stunden) section2Items.push({ description: 'Etikettierung (Std.)', value: fmt(warehousing.etikettierung_stunden) });

      // Bereich 3: Material & Verpackung
      const section3Items = [];
      if (warehousing.lieferscheintasche) section3Items.push({ description: 'Lieferscheintasche', value: fmt(warehousing.lieferscheintasche) });
      if (warehousing.kartonage1_text && warehousing.kartonage1_wert) section3Items.push({ description: warehousing.kartonage1_text, value: fmt(warehousing.kartonage1_wert) });
      if (warehousing.kartonage2_text && warehousing.kartonage2_wert) section3Items.push({ description: warehousing.kartonage2_text, value: fmt(warehousing.kartonage2_wert) });
      if (warehousing.kartonage3_text && warehousing.kartonage3_wert) section3Items.push({ description: warehousing.kartonage3_text, value: fmt(warehousing.kartonage3_wert) });

      // Add 3-column layout
      const sections = [
        { title: 'Warenein- & Ausgang', items: section1Items },
        { title: 'Retouren & Lager', items: section2Items },
        { title: 'Material & Verpackung', items: section3Items }
      ];

      pdf.addThreeColumnSections(sections);

      // Add Bemerkungen if present
      if (warehousing.bemerkungen && warehousing.bemerkungen.trim()) {
        pdf.addRemarks('Bemerkungen', warehousing.bemerkungen);
      }

      pdf.addLegalNotes([
        'Alle Preise verstehen sich pro Stück und zuzüglich MwSt.',
        'Dieses Angebot ist 30 Tage gültig.'
      ]);

      pdf.addSimpleFooter('Fashion Holding Düsseldorf GmbH | www.fhd.agency');

      pdf.save(`Angebot_${kundenName}_${new Date().toISOString().slice(0,10)}.pdf`);
      showSuccess('PDF erfolgreich erstellt!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showError('Fehler bei der PDF-Generierung');
    }
  };

  const handleReset = () => {
    setKunde('');
    setWarehousing({
      handling_in_entladung: '',
      lagerplatz_verbringen: '',
      kommissionierung_b2b: '',
      kommissionierung_b2c: '',
      zusatzarbeiten_stunden: '',
      handling_out: '',
      anmeldung_avisierung: '',
      lieferscheintasche: '',
      kartonage1_text: '',
      kartonage1_wert: '',
      kartonage2_text: '',
      kartonage2_wert: '',
      kartonage3_text: '',
      kartonage3_wert: '',
      annahme_entsorgung: '',
      grobsichtung: '',
      einhuellen_polybag: '',
      rueckfuehrung_bestand: '',
      flaeche_m2: '',
      preis_m2: '',
      inventur_stunden: '',
      etiketten_drucken_stunden: '',
      etikettierung_stunden: '',
      bemerkungen: ''
    });
    setCalculationId(null);
    showSuccess('Formular zurückgesetzt');
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

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Warehousing-Kalkulation</h1>
        <p className="text-gray-600 mb-8">Erstellen Sie eine Kalkulation für Warehousing-Dienstleistungen.</p>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <label className="block mb-2 text-gray-700 font-semibold">Kundenname / Bezeichnung</label>
          <input
            type="text"
            value={kunde}
            onChange={(e) => setKunde(e.target.value)}
            placeholder="Kundenname eingeben"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Wareneingang</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Handling in / Entladung</label>
              <input
                type="text"
                value={warehousing.handling_in_entladung}
                onChange={(e) => handleInputChange('handling_in_entladung', e.target.value)}
                onBlur={() => handleNumericBlur('handling_in_entladung')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Lagerplatz verbringen</label>
              <input
                type="text"
                value={warehousing.lagerplatz_verbringen}
                onChange={(e) => handleInputChange('lagerplatz_verbringen', e.target.value)}
                onBlur={() => handleNumericBlur('lagerplatz_verbringen')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kommissionierung B2B</label>
              <input
                type="text"
                value={warehousing.kommissionierung_b2b}
                onChange={(e) => handleInputChange('kommissionierung_b2b', e.target.value)}
                onBlur={() => handleNumericBlur('kommissionierung_b2b')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kommissionierung B2C</label>
              <input
                type="text"
                value={warehousing.kommissionierung_b2c}
                onChange={(e) => handleInputChange('kommissionierung_b2c', e.target.value)}
                onBlur={() => handleNumericBlur('kommissionierung_b2c')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Zusatzarbeiten (Inventur - Etikettierung - tec.) Stundenbasis</label>
              <input
                type="text"
                value={warehousing.zusatzarbeiten_stunden}
                onChange={(e) => handleInputChange('zusatzarbeiten_stunden', e.target.value)}
                onBlur={() => handleNumericBlur('zusatzarbeiten_stunden')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Warenausgang</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Handling out</label>
              <input
                type="text"
                value={warehousing.handling_out}
                onChange={(e) => handleInputChange('handling_out', e.target.value)}
                onBlur={() => handleNumericBlur('handling_out')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Avisierung Großkunde</label>
              <input
                type="text"
                value={warehousing.anmeldung_avisierung}
                onChange={(e) => handleInputChange('anmeldung_avisierung', e.target.value)}
                onBlur={() => handleNumericBlur('anmeldung_avisierung')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Material & Verpackung</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Lieferscheintasche</label>
              <input
                type="text"
                value={warehousing.lieferscheintasche}
                onChange={(e) => handleInputChange('lieferscheintasche', e.target.value)}
                onBlur={() => handleNumericBlur('lieferscheintasche')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 1 (Text)</label>
              <input
                type="text"
                value={warehousing.kartonage1_text}
                onChange={(e) => handleInputChange('kartonage1_text', e.target.value)}
                placeholder="Bezeichnung"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 1 (Wert)</label>
              <input
                type="text"
                value={warehousing.kartonage1_wert}
                onChange={(e) => handleInputChange('kartonage1_wert', e.target.value)}
                onBlur={() => handleNumericBlur('kartonage1_wert')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 2 (Text)</label>
              <input
                type="text"
                value={warehousing.kartonage2_text}
                onChange={(e) => handleInputChange('kartonage2_text', e.target.value)}
                placeholder="Bezeichnung"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 2 (Wert)</label>
              <input
                type="text"
                value={warehousing.kartonage2_wert}
                onChange={(e) => handleInputChange('kartonage2_wert', e.target.value)}
                onBlur={() => handleNumericBlur('kartonage2_wert')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 3 (Text)</label>
              <input
                type="text"
                value={warehousing.kartonage3_text}
                onChange={(e) => handleInputChange('kartonage3_text', e.target.value)}
                placeholder="Bezeichnung"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Kartonage 3 (Wert)</label>
              <input
                type="text"
                value={warehousing.kartonage3_wert}
                onChange={(e) => handleInputChange('kartonage3_wert', e.target.value)}
                onBlur={() => handleNumericBlur('kartonage3_wert')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Retouren</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Annahme / Entsorgung Material</label>
              <input
                type="text"
                value={warehousing.annahme_entsorgung}
                onChange={(e) => handleInputChange('annahme_entsorgung', e.target.value)}
                onBlur={() => handleNumericBlur('annahme_entsorgung')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Grobsichtung</label>
              <input
                type="text"
                value={warehousing.grobsichtung}
                onChange={(e) => handleInputChange('grobsichtung', e.target.value)}
                onBlur={() => handleNumericBlur('grobsichtung')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Neuverpackung in Single polybag</label>
              <input
                type="text"
                value={warehousing.einhuellen_polybag}
                onChange={(e) => handleInputChange('einhuellen_polybag', e.target.value)}
                onBlur={() => handleNumericBlur('einhuellen_polybag')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Lagerplatz verbringen</label>
              <input
                type="text"
                value={warehousing.rueckfuehrung_bestand}
                onChange={(e) => handleInputChange('rueckfuehrung_bestand', e.target.value)}
                onBlur={() => handleNumericBlur('rueckfuehrung_bestand')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Lager & Sonderarbeiten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Fläche (m²)</label>
              <input
                type="text"
                value={warehousing.flaeche_m2}
                onChange={(e) => handleInputChange('flaeche_m2', e.target.value)}
                onBlur={() => handleNumericBlur('flaeche_m2')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Preis pro m²</label>
              <input
                type="text"
                value={warehousing.preis_m2}
                onChange={(e) => handleInputChange('preis_m2', e.target.value)}
                onBlur={() => handleNumericBlur('preis_m2')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Inventur (Stunden)</label>
              <input
                type="text"
                value={warehousing.inventur_stunden}
                onChange={(e) => handleInputChange('inventur_stunden', e.target.value)}
                onBlur={() => handleNumericBlur('inventur_stunden')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Etiketten drucken (Stunden)</label>
              <input
                type="text"
                value={warehousing.etiketten_drucken_stunden}
                onChange={(e) => handleInputChange('etiketten_drucken_stunden', e.target.value)}
                onBlur={() => handleNumericBlur('etiketten_drucken_stunden')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700 font-semibold text-sm">Etikettierung (Stunden)</label>
              <input
                type="text"
                value={warehousing.etikettierung_stunden}
                onChange={(e) => handleInputChange('etikettierung_stunden', e.target.value)}
                onBlur={() => handleNumericBlur('etikettierung_stunden')}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">Bemerkungen</h3>
          <textarea
            value={warehousing.bemerkungen}
            onChange={(e) => handleInputChange('bemerkungen', e.target.value)}
            placeholder="Zusätzliche Bemerkungen..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[100px]"
          />
        </div>

        <div className="flex gap-4 justify-center flex-wrap mt-6">
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            disabled={saving}
          >
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
          <button
            onClick={() => setShowOfferModal(true)}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition"
          >
            Angebot erstellen
          </button>
          <button
            onClick={handleGeneratePDF}
            className="px-6 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition"
          >
            PDF erstellen
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
          >
            Zurücksetzen
          </button>
        </div>

        <OfferModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          onSubmit={handleCreateOffer}
          calculationType="warehousing"
        />
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </Layout>
  );
};

export default WarehousingCalculation;
