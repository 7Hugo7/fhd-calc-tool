import React, { useState } from 'react';

const OfferModal = ({ isOpen, onClose, onSubmit, calculationType = 'garment' }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_company: '',
    customer_street: '',
    customer_postal_code: '',
    customer_city: '',
    customer_country: 'Deutschland',
    customer_email: '',
    customer_phone: '',
    valid_until: '',
    message: '',
    delivery_option: 'frei_haus'
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    },
    modal: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '30px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflowY: 'auto'
    },
    title: {
      fontSize: '20px',
      fontWeight: 'bold',
      marginBottom: '20px',
      color: '#1a1a1a'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px'
    },
    formGroup: {
      marginBottom: '15px'
    },
    fullWidth: {
      gridColumn: '1 / -1'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: '600',
      fontSize: '14px',
      color: '#374151'
    },
    input: {
      width: '100%',
      padding: '10px',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      fontSize: '14px',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '10px',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      fontSize: '14px',
      boxSizing: 'border-box',
      minHeight: '80px',
      resize: 'vertical',
      fontFamily: 'inherit'
    },
    select: {
      width: '100%',
      padding: '10px',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      fontSize: '14px',
      boxSizing: 'border-box',
      backgroundColor: 'white'
    },
    buttonGroup: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px'
    },
    cancelBtn: {
      padding: '10px 20px',
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600'
    },
    submitBtn: {
      padding: '10px 20px',
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600'
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Angebot erstellen</h2>

        <form onSubmit={handleSubmit}>
          <div style={styles.grid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Ansprechpartner</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => handleChange('customer_name', e.target.value)}
                style={styles.input}
                placeholder="Name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Firma</label>
              <input
                type="text"
                value={formData.customer_company}
                onChange={(e) => handleChange('customer_company', e.target.value)}
                style={styles.input}
                placeholder="Firmenname"
              />
            </div>

            <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
              <label style={styles.label}>Straße</label>
              <input
                type="text"
                value={formData.customer_street}
                onChange={(e) => handleChange('customer_street', e.target.value)}
                style={styles.input}
                placeholder="Straße und Hausnummer"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>PLZ</label>
              <input
                type="text"
                value={formData.customer_postal_code}
                onChange={(e) => handleChange('customer_postal_code', e.target.value)}
                style={styles.input}
                placeholder="PLZ"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Stadt</label>
              <input
                type="text"
                value={formData.customer_city}
                onChange={(e) => handleChange('customer_city', e.target.value)}
                style={styles.input}
                placeholder="Stadt"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Land</label>
              <input
                type="text"
                value={formData.customer_country}
                onChange={(e) => handleChange('customer_country', e.target.value)}
                style={styles.input}
                placeholder="Land"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>E-Mail</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => handleChange('customer_email', e.target.value)}
                style={styles.input}
                placeholder="email@beispiel.de"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Telefon</label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => handleChange('customer_phone', e.target.value)}
                style={styles.input}
                placeholder="+49 123 456789"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Gültig bis</label>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => handleChange('valid_until', e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Lieferoption</label>
              <select
                value={formData.delivery_option}
                onChange={(e) => handleChange('delivery_option', e.target.value)}
                style={styles.select}
              >
                <option value="frei_haus">Frei Haus</option>
                <option value="ab_werk">Ab Werk</option>
              </select>
            </div>

            <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
              <label style={styles.label}>Nachricht / Anschreiben</label>
              <textarea
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                style={styles.textarea}
                placeholder="Optionale Nachricht für das Angebot..."
              />
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Abbrechen
            </button>
            <button type="submit" style={styles.submitBtn}>
              Angebot erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OfferModal;
