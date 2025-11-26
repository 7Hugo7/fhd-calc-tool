import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

const OfferDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sending, setSending] = useState(false);
  const pdfDownloadTriggered = useRef(false);

  useEffect(() => {
    if (id) {
      loadOffer(parseInt(id));
    }
  }, [id]);

  // Auto-trigger PDF download if action=pdf is in URL
  useEffect(() => {
    if (offer && searchParams.get('action') === 'pdf' && !pdfDownloadTriggered.current) {
      pdfDownloadTriggered.current = true;
      handleDownloadPDF();
    }
  }, [offer, searchParams]);

  const loadOffer = async (offerId) => {
    try {
      setLoading(true);
      const response = await api.get(`/calculations/offers/${offerId}`);
      setOffer(response.data);
    } catch (error) {
      console.error('Error loading offer:', error);
      showError('Fehler beim Laden des Angebots');
      setTimeout(() => navigate('/offers'), 2000);
    } finally {
      setLoading(false);
    }
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

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(num)) return '-';
    return `${num.toFixed(2).replace('.', ',')} EUR`;
  };

  const handleDownloadPDF = async () => {
    try {
      const PDFGenerator = (await import('../utils/pdfGenerator')).default;
      const pdf = new PDFGenerator();

      await pdf.loadLogo('/fhd_logo.png');
      pdf.addLogo(40);

      const today = new Date().toLocaleDateString('de-DE');
      const validUntil = offer.valid_until
        ? new Date(offer.valid_until).toLocaleDateString('de-DE')
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE');

      pdf.addFullHeader(
        { offerNumber: offer.offer_number || '', date: today, validUntil: validUntil },
        {
          company: offer.customer_company || offer.kunde,
          name: offer.customer_name || undefined,
          street: offer.customer_street || undefined,
          postalCode: offer.customer_postal_code || undefined,
          city: offer.customer_city || undefined,
          country: offer.customer_country || undefined
        }
      );

      pdf.addDocumentTitle('ANGEBOT');

      const defaultMessage = `Sehr geehrte Damen und Herren,

vielen Dank für Ihr Interesse an unseren Produkten.
Anbei übersenden wir Ihnen wie besprochen unser Angebot.

Wir freuen uns auf Ihre Rückmeldung und stehen Ihnen für Rückfragen gerne zur Verfügung.

Mit freundlichen Grüßen
Fashion Holding Düsseldorf GmbH`;

      pdf.addMessage(offer.message || defaultMessage);

      const fmt = (val, suffix = ' EUR') => {
        if (!val && val !== 0) return null;
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
        if (isNaN(num)) return null;
        return num.toFixed(2).replace('.', ',') + suffix;
      };

      if (offer.offer_type === 'garment' && offer.items && offer.items.length > 0) {
        offer.items.forEach((item, index) => {
          const sectionItems = [];
          if (item.composition) sectionItems.push({ description: 'Zusammensetzung', value: item.composition });
          if (item.gg) sectionItems.push({ description: 'GG', value: item.gg });
          if (item.material) sectionItems.push({ description: 'Material', value: item.material });
          if (item.lieferung) sectionItems.push({ description: 'Lieferung', value: item.lieferung });
          if (item.lieferzeit) sectionItems.push({ description: 'Lieferzeit', value: item.lieferzeit });
          if (item.produktionszeitraum) sectionItems.push({ description: 'Produktionszeitraum', value: item.produktionszeitraum });
          if (item.frachtzeitraum) sectionItems.push({ description: 'Frachtzeitraum', value: item.frachtzeitraum });
          if (fmt(item.luftfrachtzuschlag)) sectionItems.push({ description: 'Luftfracht Zuschlag', value: fmt(item.luftfrachtzuschlag) });

          if (offer.delivery_option) {
            const deliveryText = offer.delivery_option === 'frei_haus' ? 'Frei Haus' : 'Ab Werk Hattingen';
            sectionItems.push({ description: 'Lieferbedingung', value: deliveryText });
          }

          sectionItems.push({ description: 'Einzelpreis netto', value: fmt(item.vk_gesetzt) || '-', highlight: true });

          pdf.addSection({
            title: `Position ${item.item_number || index + 1}: ${item.style || 'Unbenannt'}`,
            items: sectionItems
          });
        });
      } else if (offer.offer_type === 'warehousing' && offer.warehousing) {
        const data = offer.warehousing;
        const sectionItems = [];

        if (fmt(data.handling_in_entladung)) sectionItems.push({ description: 'Handling IN - Entladung (pro Stück)', value: fmt(data.handling_in_entladung) });
        if (fmt(data.lagerplatz_verbringen)) sectionItems.push({ description: 'Lagerplatz verbringen (pro Stück)', value: fmt(data.lagerplatz_verbringen) });
        if (fmt(data.kommissionierung_b2b)) sectionItems.push({ description: 'Kommissionierung B2B (pro Stück)', value: fmt(data.kommissionierung_b2b) });
        if (fmt(data.kommissionierung_b2c)) sectionItems.push({ description: 'Kommissionierung B2C (pro Stück)', value: fmt(data.kommissionierung_b2c) });
        if (fmt(data.zusatzarbeiten_stunden)) sectionItems.push({ description: 'Zusatzarbeiten (pro Stunde)', value: fmt(data.zusatzarbeiten_stunden) });
        if (fmt(data.handling_out)) sectionItems.push({ description: 'Handling OUT (pro Stück)', value: fmt(data.handling_out) });
        if (fmt(data.anmeldung_avisierung)) sectionItems.push({ description: 'Anmeldung/Avisierung', value: fmt(data.anmeldung_avisierung) });
        if (fmt(data.lieferscheintasche)) sectionItems.push({ description: 'Lieferscheintasche', value: fmt(data.lieferscheintasche) });
        if (data.kartonage1_text && fmt(data.kartonage1_wert)) sectionItems.push({ description: data.kartonage1_text, value: fmt(data.kartonage1_wert) });
        if (data.kartonage2_text && fmt(data.kartonage2_wert)) sectionItems.push({ description: data.kartonage2_text, value: fmt(data.kartonage2_wert) });
        if (data.kartonage3_text && fmt(data.kartonage3_wert)) sectionItems.push({ description: data.kartonage3_text, value: fmt(data.kartonage3_wert) });
        if (fmt(data.annahme_entsorgung)) sectionItems.push({ description: 'Annahme/Entsorgung', value: fmt(data.annahme_entsorgung) });
        if (fmt(data.grobsichtung)) sectionItems.push({ description: 'Grobsichtung', value: fmt(data.grobsichtung) });
        if (fmt(data.einhuellen_polybag)) sectionItems.push({ description: 'Einhüllen Polybag', value: fmt(data.einhuellen_polybag) });
        if (fmt(data.rueckfuehrung_bestand)) sectionItems.push({ description: 'Rückführung Bestand', value: fmt(data.rueckfuehrung_bestand) });
        if (fmt(data.flaeche_m2) && fmt(data.preis_m2)) sectionItems.push({ description: `Lagerfläche (${data.flaeche_m2} m²)`, value: fmt(data.preis_m2, ' EUR/m²') });
        if (fmt(data.inventur_stunden)) sectionItems.push({ description: 'Inventur (pro Stunde)', value: fmt(data.inventur_stunden) });
        if (fmt(data.etiketten_drucken_stunden)) sectionItems.push({ description: 'Etiketten drucken (pro Stunde)', value: fmt(data.etiketten_drucken_stunden) });
        if (fmt(data.etikettierung_stunden)) sectionItems.push({ description: 'Etikettierung (pro Stunde)', value: fmt(data.etikettierung_stunden) });

        pdf.addSection({
          title: 'Warehousing-Leistungen',
          items: sectionItems
        });
      }

      pdf.addLegalNotes([
        'Alle Preise verstehen sich zuzüglich MwSt.',
        'Dieses Angebot ist 30 Tage ab Ausstellungsdatum gültig.'
      ]);

      pdf.addSimpleFooter('Fashion Holding Düsseldorf GmbH | www.fhd.agency');

      pdf.save(`Angebot_${offer.offer_number || offer.id}_${today.replace(/\./g, '-')}.pdf`);
      showSuccess('PDF erfolgreich heruntergeladen!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showError('Fehler bei der PDF-Generierung');
    }
  };

  const handleSendEmail = async () => {
    const recipientEmail = emailRecipient || offer.customer_email;
    if (!recipientEmail) {
      showError('Bitte geben Sie eine E-Mail-Adresse ein');
      return;
    }

    try {
      setSending(true);

      // Generate PDF as base64
      const PDFGenerator = (await import('../utils/pdfGenerator')).default;
      const pdf = new PDFGenerator();

      await pdf.loadLogo('/fhd_logo.png');
      pdf.addLogo(40);

      const today = new Date().toLocaleDateString('de-DE');
      const validUntil = offer.valid_until
        ? new Date(offer.valid_until).toLocaleDateString('de-DE')
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE');

      pdf.addFullHeader(
        { offerNumber: offer.offer_number || '', date: today, validUntil: validUntil },
        {
          company: offer.customer_company || offer.kunde,
          name: offer.customer_name || undefined,
          street: offer.customer_street || undefined,
          postalCode: offer.customer_postal_code || undefined,
          city: offer.customer_city || undefined,
          country: offer.customer_country || undefined
        }
      );

      pdf.addDocumentTitle('ANGEBOT');

      const defaultMessage = `Sehr geehrte Damen und Herren,

vielen Dank für Ihr Interesse an unseren Produkten.
Anbei übersenden wir Ihnen wie besprochen unser Angebot.

Wir freuen uns auf Ihre Rückmeldung und stehen Ihnen für Rückfragen gerne zur Verfügung.

Mit freundlichen Grüßen
Fashion Holding Düsseldorf GmbH`;

      pdf.addMessage(offer.message || defaultMessage);

      const fmt = (val, suffix = ' EUR') => {
        if (!val && val !== 0) return null;
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
        if (isNaN(num)) return null;
        return num.toFixed(2).replace('.', ',') + suffix;
      };

      if (offer.offer_type === 'garment' && offer.items && offer.items.length > 0) {
        offer.items.forEach((item, index) => {
          const sectionItems = [];
          if (item.composition) sectionItems.push({ description: 'Zusammensetzung', value: item.composition });
          if (item.gg) sectionItems.push({ description: 'GG', value: item.gg });
          if (item.material) sectionItems.push({ description: 'Material', value: item.material });
          if (item.lieferung) sectionItems.push({ description: 'Lieferung', value: item.lieferung });
          if (item.lieferzeit) sectionItems.push({ description: 'Lieferzeit', value: item.lieferzeit });
          if (item.produktionszeitraum) sectionItems.push({ description: 'Produktionszeitraum', value: item.produktionszeitraum });
          if (item.frachtzeitraum) sectionItems.push({ description: 'Frachtzeitraum', value: item.frachtzeitraum });
          if (fmt(item.luftfrachtzuschlag)) sectionItems.push({ description: 'Luftfracht Zuschlag', value: fmt(item.luftfrachtzuschlag) });

          if (offer.delivery_option) {
            const deliveryText = offer.delivery_option === 'frei_haus' ? 'Frei Haus' : 'Ab Werk Hattingen';
            sectionItems.push({ description: 'Lieferbedingung', value: deliveryText });
          }

          sectionItems.push({ description: 'Einzelpreis netto', value: fmt(item.vk_gesetzt) || '-', highlight: true });

          pdf.addSection({
            title: `Position ${item.item_number || index + 1}: ${item.style || 'Unbenannt'}`,
            items: sectionItems
          });
        });
      } else if (offer.offer_type === 'warehousing' && offer.warehousing) {
        const data = offer.warehousing;
        const sectionItems = [];

        if (fmt(data.handling_in_entladung)) sectionItems.push({ description: 'Handling IN - Entladung (pro Stück)', value: fmt(data.handling_in_entladung) });
        if (fmt(data.lagerplatz_verbringen)) sectionItems.push({ description: 'Lagerplatz verbringen (pro Stück)', value: fmt(data.lagerplatz_verbringen) });
        if (fmt(data.kommissionierung_b2b)) sectionItems.push({ description: 'Kommissionierung B2B (pro Stück)', value: fmt(data.kommissionierung_b2b) });
        if (fmt(data.kommissionierung_b2c)) sectionItems.push({ description: 'Kommissionierung B2C (pro Stück)', value: fmt(data.kommissionierung_b2c) });
        if (fmt(data.zusatzarbeiten_stunden)) sectionItems.push({ description: 'Zusatzarbeiten (pro Stunde)', value: fmt(data.zusatzarbeiten_stunden) });
        if (fmt(data.handling_out)) sectionItems.push({ description: 'Handling OUT (pro Stück)', value: fmt(data.handling_out) });
        if (fmt(data.anmeldung_avisierung)) sectionItems.push({ description: 'Anmeldung/Avisierung', value: fmt(data.anmeldung_avisierung) });
        if (fmt(data.lieferscheintasche)) sectionItems.push({ description: 'Lieferscheintasche', value: fmt(data.lieferscheintasche) });
        if (data.kartonage1_text && fmt(data.kartonage1_wert)) sectionItems.push({ description: data.kartonage1_text, value: fmt(data.kartonage1_wert) });
        if (data.kartonage2_text && fmt(data.kartonage2_wert)) sectionItems.push({ description: data.kartonage2_text, value: fmt(data.kartonage2_wert) });
        if (data.kartonage3_text && fmt(data.kartonage3_wert)) sectionItems.push({ description: data.kartonage3_text, value: fmt(data.kartonage3_wert) });
        if (fmt(data.annahme_entsorgung)) sectionItems.push({ description: 'Annahme/Entsorgung', value: fmt(data.annahme_entsorgung) });
        if (fmt(data.grobsichtung)) sectionItems.push({ description: 'Grobsichtung', value: fmt(data.grobsichtung) });
        if (fmt(data.einhuellen_polybag)) sectionItems.push({ description: 'Einhüllen Polybag', value: fmt(data.einhuellen_polybag) });
        if (fmt(data.rueckfuehrung_bestand)) sectionItems.push({ description: 'Rückführung Bestand', value: fmt(data.rueckfuehrung_bestand) });
        if (fmt(data.flaeche_m2) && fmt(data.preis_m2)) sectionItems.push({ description: `Lagerfläche (${data.flaeche_m2} m²)`, value: fmt(data.preis_m2, ' EUR/m²') });
        if (fmt(data.inventur_stunden)) sectionItems.push({ description: 'Inventur (pro Stunde)', value: fmt(data.inventur_stunden) });
        if (fmt(data.etiketten_drucken_stunden)) sectionItems.push({ description: 'Etiketten drucken (pro Stunde)', value: fmt(data.etiketten_drucken_stunden) });
        if (fmt(data.etikettierung_stunden)) sectionItems.push({ description: 'Etikettierung (pro Stunde)', value: fmt(data.etikettierung_stunden) });

        pdf.addSection({
          title: 'Warehousing-Leistungen',
          items: sectionItems
        });
      }

      pdf.addLegalNotes([
        'Alle Preise verstehen sich zuzüglich MwSt.',
        'Dieses Angebot ist 30 Tage ab Ausstellungsdatum gültig.'
      ]);

      pdf.addSimpleFooter('Fashion Holding Düsseldorf GmbH | www.fhd.agency');

      // Get PDF as base64
      const pdfBase64 = pdf.doc.output('datauristring').split(',')[1];

      // Send email
      const response = await api.post(`/calculations/offers/${offer.id}/send-email`, {
        pdfBase64,
        recipient: recipientEmail,
        subject: emailSubject || undefined,
        message: emailMessage || undefined
      });

      if (response.data.success) {
        showSuccess(`E-Mail erfolgreich an ${recipientEmail} gesendet!`);
        setShowEmailModal(false);
        setEmailRecipient('');
        setEmailSubject('');
        setEmailMessage('');
        // Reload offer to get updated status
        loadOffer(parseInt(id));
      }
    } catch (error) {
      console.error('Email send failed:', error);
      showError('Fehler beim Senden der E-Mail: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">Lädt...</div>
      </Layout>
    );
  }

  if (!offer) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">Angebot nicht gefunden</div>
      </Layout>
    );
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'sent': return 'Gesendet';
      case 'accepted': return 'Angenommen';
      case 'rejected': return 'Abgelehnt';
      default: return 'Ausstehend';
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Angebot {offer.offer_number || `#${offer.id}`}</h1>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              PDF herunterladen
            </button>
            <button
              onClick={() => {
                setEmailRecipient(offer.customer_email || '');
                setShowEmailModal(true);
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            >
              Per E-Mail senden
            </button>
            <button
              onClick={() => navigate('/offers')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
            >
              Zurück
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Angebotdetails</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Typ</div>
              <div className="text-sm">{offer.offer_type === 'warehousing' ? 'Warehousing' : 'Garment'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Status</div>
              <div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusStyle(offer.status)}`}>
                  {getStatusLabel(offer.status)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Erstellt am</div>
              <div className="text-sm">{formatDate(offer.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Gültig bis</div>
              <div className="text-sm">{formatDate(offer.valid_until)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Kunde</div>
              <div className="text-sm">{offer.kunde}</div>
            </div>
            {offer.offer_type === 'garment' && (
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Lieferoption</div>
                <div className="text-sm">{offer.delivery_option === 'frei_haus' ? 'Frei Haus' : 'Ab Werk'}</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Empfänger</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Firma</div>
              <div className="text-sm">{offer.customer_company || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Ansprechpartner</div>
              <div className="text-sm">{offer.customer_name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Straße</div>
              <div className="text-sm">{offer.customer_street || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">PLZ / Stadt</div>
              <div className="text-sm">{[offer.customer_postal_code, offer.customer_city].filter(Boolean).join(' ') || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Land</div>
              <div className="text-sm">{offer.customer_country || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">E-Mail</div>
              <div className="text-sm">{offer.customer_email || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Telefon</div>
              <div className="text-sm">{offer.customer_phone || '-'}</div>
            </div>
          </div>
        </div>

        {offer.message && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Anschreiben</h2>
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="whitespace-pre-wrap">{offer.message}</p>
            </div>
          </div>
        )}

        {offer.offer_type === 'garment' && offer.items && offer.items.length > 0 && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Garment-Artikel</h2>
            {offer.items.map((item, index) => (
              <div key={index} className="mb-6 pb-6 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                <h3 className="font-semibold mb-3">Artikel {item.item_number}: {item.style || 'Unbenannt'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">Material</div>
                    <div className="text-sm">{item.material || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">Lieferant</div>
                    <div className="text-sm">{item.lieferant || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">Selbstkosten</div>
                    <div className="text-sm">{formatCurrency(item.selbstkosten)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">VK Gesetzt</div>
                    <div className="text-sm font-bold text-green-600">{formatCurrency(item.vk_gesetzt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {offer.offer_type === 'warehousing' && offer.warehousing && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Warehousing-Daten</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Handling IN / Entladung</div>
                <div className="text-sm">{formatCurrency(offer.warehousing.handling_in_entladung)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Lagerplatz verbringen</div>
                <div className="text-sm">{formatCurrency(offer.warehousing.lagerplatz_verbringen)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Kommissionierung B2B</div>
                <div className="text-sm">{formatCurrency(offer.warehousing.kommissionierung_b2b)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Kommissionierung B2C</div>
                <div className="text-sm">{formatCurrency(offer.warehousing.kommissionierung_b2c)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Handling OUT</div>
                <div className="text-sm">{formatCurrency(offer.warehousing.handling_out)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmailModal(false)}>
            <div className="bg-white p-8 rounded-xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Angebot per E-Mail senden</h3>
              <div className="mb-4">
                <label className="block mb-1 text-gray-700 font-semibold text-sm">Empfänger E-Mail *</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="email@beispiel.de"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 text-gray-700 font-semibold text-sm">Betreff (optional)</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={`Angebot von Fashion Holding Düsseldorf - ${offer.offer_number || offer.id}`}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 text-gray-700 font-semibold text-sm">Nachricht (optional)</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[120px]"
                  placeholder="Sehr geehrte/r Kunde,&#10;&#10;anbei erhalten Sie unser Angebot wie besprochen.&#10;&#10;Mit freundlichen Grüßen,&#10;Fashion Holding Düsseldorf GmbH"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailSubject('');
                    setEmailMessage('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className={`px-4 py-2 ${sending ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg font-semibold transition`}
                >
                  {sending ? 'Wird gesendet...' : 'E-Mail senden'}
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

export default OfferDetail;
