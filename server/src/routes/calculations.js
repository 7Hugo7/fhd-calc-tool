import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Helper function to generate offer number (FHD{YEAR}-{COUNTER}.{VERSION})
const generateOfferNumber = (version = 1) => {
  const year = new Date().getFullYear();
  const counterKey = `offer_number_${year}`;

  console.log(`Generating offer number for version ${version}, key: ${counterKey}`);

  // Get or create the yearly counter from counters_table
  let counter = db.prepare(`SELECT * FROM counters_table WHERE key = ?`).get(counterKey);
  console.log(`Counter query result:`, counter);

  if (!counter) {
    // Initialize counter for this year
    console.log(`Creating new counter for ${counterKey}`);
    db.prepare(`INSERT INTO counters_table (key, value) VALUES (?, ?)`).run(counterKey, 1);
    counter = { value: 1 };
  } else {
    // Increment counter - we need to get current value first, then update
    const newValue = counter.value + 1;
    console.log(`Incrementing counter from ${counter.value} to ${newValue}`);
    db.prepare(`UPDATE counters_table SET value = ? WHERE key = ?`).run(newValue, counterKey);
    counter = { value: newValue };
  }

  const paddedCounter = String(counter.value).padStart(4, '0');
  const offerNumber = `FHD${year}-${paddedCounter}.${version}`;
  console.log(`Generated offer number: ${offerNumber}`);
  return offerNumber;
};

// Helper to update offer number version only (keep same base number)
const updateOfferNumberVersion = (baseOfferNumber, newVersion) => {
  if (!baseOfferNumber) return null;
  // Replace version part: FHD2025-0001.1 -> FHD2025-0001.2
  const basePart = baseOfferNumber.split('.')[0];
  return `${basePart}.${newVersion}`;
};

// Helper function to parse German decimal format (1,23) to float
const parseGermanFloat = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const str = String(value).replace(',', '.');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
};

// Helper function to log calculation actions
const logAction = (action, entityType, entityId, entityUuid, user, details = null) => {
  try {
    db.prepare(`
      INSERT INTO calculation_logs (action, entity_type, entity_id, entity_uuid, user_id, user_name, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      action,
      entityType,
      entityId,
      entityUuid,
      user?.id || null,
      user?.name || null,
      details ? JSON.stringify(details) : null
    );
  } catch (error) {
    console.error('Logging error:', error);
  }
};

// GET all calculations (excludes soft-deleted)
router.get('/', (req, res) => {
  try {
    const calculations = db.prepare(`
      SELECT c.*, u.name as created_by_name
      FROM calculations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `).all();

    const result = calculations.map(calc => ({
      id: calc.id,
      calculation_uuid: calc.calculation_uuid,
      title: calc.kunde,
      created_at: calc.created_at,
      version: calc.version,
      calculation_type: calc.calculation_type,
      status: calc.status,
      is_current: calc.is_current,
      offer_number: calc.offer_number,
      created_by: calc.created_by_name
    }));

    res.json(result);
  } catch (error) {
    console.error('GET calculations error:', error);
    res.status(500).json({ error: 'Failed to load calculations' });
  }
});

// GET latest version by UUID
router.get('/uuid/:uuid/latest', (req, res) => {
  try {
    const uuid = req.params.uuid;

    let calculation = db.prepare(`
      SELECT * FROM calculations
      WHERE calculation_uuid = ? AND is_current = 1
    `).get(uuid);

    if (!calculation) {
      return res.status(404).json({ error: 'Calculation not found' });
    }

    // Auto-generate offer_number for existing calculations without one
    if (!calculation.offer_number) {
      const offerNumber = generateOfferNumber(calculation.version || 1);
      db.prepare('UPDATE calculations SET offer_number = ? WHERE id = ?').run(offerNumber, calculation.id);
      calculation.offer_number = offerNumber;
    }

    const result = buildCalculationResponse(calculation);
    res.json(result);
  } catch (error) {
    console.error('GET latest calculation error:', error);
    res.status(500).json({ error: 'Failed to load calculation' });
  }
});

// GET version history for a calculation
router.get('/:id/versions', (req, res) => {
  try {
    const idOrUuid = req.params.id;
    const id = parseInt(idOrUuid);
    const isNumericId = !isNaN(id);

    let calculationUuid;

    if (isNumericId) {
      const calculation = db.prepare('SELECT calculation_uuid FROM calculations WHERE id = ?').get(id);
      if (!calculation) {
        return res.status(404).json({ error: 'Calculation not found' });
      }
      calculationUuid = calculation.calculation_uuid;
    } else {
      calculationUuid = idOrUuid;
    }

    const versions = db.prepare(`
      SELECT c.*, u.name as created_by_name
      FROM calculations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.calculation_uuid = ?
      ORDER BY c.version DESC
    `).all(calculationUuid);

    if (versions.length === 0) {
      return res.status(404).json({ error: 'No versions found' });
    }

    const result = versions.map(v => ({
      id: v.id,
      calculation_id: v.id,
      calculation_uuid: v.calculation_uuid,
      version: v.version,
      changed_at: v.modified_at,
      changed_by: v.created_by_name || 'Unknown',
      change_description: v.is_current ? 'Current version' : `Version ${v.version}`,
      is_current: v.is_current
    }));

    res.json(result);
  } catch (error) {
    console.error('GET versions error:', error);
    res.status(500).json({ error: 'Failed to load versions' });
  }
});

// GET calculation by ID
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);

    let calculation = db.prepare('SELECT * FROM calculations WHERE id = ?').get(id);

    if (!calculation) {
      return res.status(404).json({ error: 'Calculation not found' });
    }

    // Auto-generate offer_number for existing calculations without one
    if (!calculation.offer_number) {
      console.log(`Calculation ${id} has no offer_number, generating...`);
      const offerNumber = generateOfferNumber(calculation.version || 1);
      console.log(`Updating calculation ${id} with offer_number: ${offerNumber}`);
      db.prepare('UPDATE calculations SET offer_number = ? WHERE id = ?').run(offerNumber, id);
      calculation.offer_number = offerNumber;
      console.log(`Calculation ${id} now has offer_number: ${calculation.offer_number}`);
    } else {
      console.log(`Calculation ${id} already has offer_number: ${calculation.offer_number}`);
    }

    const result = buildCalculationResponse(calculation);
    console.log(`Returning calculation with offer_number: ${result.offer_number}`);
    res.json(result);
  } catch (error) {
    console.error('GET calculation error:', error);
    res.status(500).json({ error: 'Failed to load calculation' });
  }
});

// Helper function to build calculation response with associated data
function buildCalculationResponse(calculation) {
  const result = {
    id: calculation.id,
    calculation_uuid: calculation.calculation_uuid,
    version: calculation.version,
    kunde: calculation.kunde,
    status: calculation.status,
    calculation_type: calculation.calculation_type,
    offer_number: calculation.offer_number,
    created_at: calculation.created_at,
    modified_at: calculation.modified_at,
    is_current: calculation.is_current,
    parent_version_id: calculation.parent_version_id
  };

  if (calculation.calculation_type === 'garment') {
    const items = db.prepare(`
      SELECT * FROM garment_data WHERE calculation_id = ? ORDER BY item_number ASC
    `).all(calculation.id);

    result.items = items.map(item => ({
      item_number: item.item_number,
      fob_preis_usd: item.fob_preis_usd,
      kurs: item.kurs,
      fob_preis_eur: item.fob_preis_eur,
      fracht: item.fracht,
      zoll_prozent: item.zoll_prozent,
      zoll: item.zoll,
      aufbereitung: item.aufbereitung,
      selbstkosten: item.selbstkosten,
      fhd_aufschlag_prozent: item.fhd_aufschlag_prozent,
      fhd_aufschlag_wert: item.fhd_aufschlag_wert,
      vk_roh: item.vk_roh,
      vk_gesetzt: item.vk_gesetzt,
      provision_agent_prozent: item.provision_agent_prozent,
      provision_agent_wert: item.provision_agent_wert,
      marge_real: item.marge_real,
      style: item.style,
      composition: item.composition,
      gg: item.gg,
      material: item.material,
      lieferung: item.lieferung,
      lieferant: item.lieferant,
      lieferzeit: item.lieferzeit,
      produktionszeitraum: item.produktionszeitraum,
      frachtzeitraum: item.frachtzeitraum,
      luftfrachtzuschlag: item.luftfrachtzuschlag,
      bemerkungen: item.bemerkungen
    }));
  } else if (calculation.calculation_type === 'warehousing') {
    const wh = db.prepare('SELECT * FROM warehousing_data WHERE calculation_id = ?').get(calculation.id);
    if (wh) {
      result.warehousing = {
        handling_in_entladung: wh.handling_in_entladung,
        lagerplatz_verbringen: wh.lagerplatz_verbringen,
        kommissionierung_b2b: wh.kommissionierung_b2b,
        kommissionierung_b2c: wh.kommissionierung_b2c,
        zusatzarbeiten_stunden: wh.zusatzarbeiten_stunden,
        handling_out: wh.handling_out,
        anmeldung_avisierung: wh.anmeldung_avisierung,
        lieferscheintasche: wh.lieferscheintasche,
        kartonage1_text: wh.kartonage1_text,
        kartonage1_wert: wh.kartonage1_wert,
        kartonage2_text: wh.kartonage2_text,
        kartonage2_wert: wh.kartonage2_wert,
        kartonage3_text: wh.kartonage3_text,
        kartonage3_wert: wh.kartonage3_wert,
        annahme_entsorgung: wh.annahme_entsorgung,
        grobsichtung: wh.grobsichtung,
        einhuellen_polybag: wh.einhuellen_polybag,
        rueckfuehrung_bestand: wh.rueckfuehrung_bestand,
        flaeche_m2: wh.flaeche_m2,
        preis_m2: wh.preis_m2,
        inventur_stunden: wh.inventur_stunden,
        etiketten_drucken_stunden: wh.etiketten_drucken_stunden,
        etikettierung_stunden: wh.etikettierung_stunden,
        bemerkungen: wh.bemerkungen
      };
    }
  }

  return result;
}

// POST new calculation
router.post('/', (req, res) => {
  try {
    const data = req.body;
    const calcType = data.calculation_type || 'garment';
    const calculationUuid = uuidv4();
    const offerNumber = generateOfferNumber(1);

    console.log(`Creating new ${calcType} calculation:`, data.kunde, `Offer: ${offerNumber}`);

    const result = db.prepare(`
      INSERT INTO calculations (calculation_uuid, version, kunde, created_by, status, calculation_type, offer_number, created_at, modified_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(calculationUuid, data.kunde, req.user.id, data.status || 'draft', calcType, offerNumber);

    const calcId = result.lastInsertRowid;

    // Insert associated data
    if (calcType === 'garment' && data.items) {
      insertGarmentItems(calcId, data.items);
    } else if (calcType === 'warehousing' && data.warehousing) {
      insertWarehousingData(calcId, data.warehousing);
    }

    // Log the action
    logAction('CREATE', 'calculation', calcId, calculationUuid, req.user, {
      kunde: data.kunde,
      calculation_type: calcType,
      offer_number: offerNumber
    });

    console.log(`Created new ${calcType} calculation ID ${calcId}`);
    res.json({
      id: calcId,
      success: true,
      message: 'Created successfully',
      calculation_uuid: calculationUuid,
      version: 1,
      offer_number: offerNumber
    });
  } catch (error) {
    console.error('POST calculation error:', error);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

// PUT update calculation - creates a NEW VERSION
router.put('/:id', (req, res) => {
  try {
    const oldId = parseInt(req.params.id);
    const data = req.body;
    const calcType = data.calculation_type || 'garment';

    console.log(`Creating new version of ${calcType} calculation ID ${oldId}`);

    // Get the old calculation
    const oldCalc = db.prepare('SELECT * FROM calculations WHERE id = ?').get(oldId);
    if (!oldCalc) {
      return res.status(404).json({ error: 'Original calculation not found' });
    }

    // Mark old calculation as not current
    db.prepare('UPDATE calculations SET is_current = 0 WHERE id = ?').run(oldId);

    // Update offer number with new version
    const newVersion = oldCalc.version + 1;
    const newOfferNumber = updateOfferNumberVersion(oldCalc.offer_number, newVersion);

    // Create new version
    const result = db.prepare(`
      INSERT INTO calculations (calculation_uuid, version, kunde, created_by, status, calculation_type, offer_number, is_current, parent_version_id, created_at, modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `).run(
      oldCalc.calculation_uuid,
      newVersion,
      data.kunde,
      oldCalc.created_by,
      data.status || 'draft',
      calcType,
      newOfferNumber,
      oldId
    );

    const newId = result.lastInsertRowid;

    // Insert associated data
    if (calcType === 'garment' && data.items) {
      insertGarmentItems(newId, data.items);
    } else if (calcType === 'warehousing' && data.warehousing) {
      insertWarehousingData(newId, data.warehousing);
    }

    console.log(`Created version ${newVersion}, new ID: ${newId}, Offer: ${newOfferNumber}`);
    res.json({
      id: newId,
      success: true,
      message: 'New version created successfully',
      calculation_uuid: oldCalc.calculation_uuid,
      version: newVersion,
      offer_number: newOfferNumber
    });
  } catch (error) {
    console.error('PUT calculation error:', error);
    res.status(500).json({ error: 'Failed to create new version' });
  }
});

// DELETE calculation (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get calculation info for logging
    const calc = db.prepare('SELECT * FROM calculations WHERE id = ?').get(id);

    // Soft delete
    db.prepare("UPDATE calculations SET deleted_at = datetime('now') WHERE id = ?").run(id);

    // Log the action
    logAction('DELETE', 'calculation', id, calc?.calculation_uuid, req.user, {
      kunde: calc?.kunde,
      calculation_type: calc?.calculation_type
    });

    console.log(`Soft deleted calculation ID ${id}`);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('DELETE calculation error:', error);
    res.status(500).json({ error: 'Failed to delete calculation' });
  }
});

// PATCH update title only (without creating new version)
router.patch('/:uuid/title', (req, res) => {
  try {
    const { uuid } = req.params;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Update all versions with this UUID
    const result = db.prepare(`
      UPDATE calculations
      SET kunde = ?, modified_at = datetime('now')
      WHERE calculation_uuid = ? AND deleted_at IS NULL
    `).run(title.trim(), uuid);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Calculation not found' });
    }

    console.log(`Updated title for calculation UUID ${uuid} to "${title}"`);
    res.json({ success: true, message: 'Title updated successfully' });
  } catch (error) {
    console.error('PATCH title error:', error);
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// Helper function to insert garment items
function insertGarmentItems(calcId, items) {
  const stmt = db.prepare(`
    INSERT INTO garment_data (
      calculation_id, item_number, fob_preis_usd, kurs, fob_preis_eur, fracht,
      zoll_prozent, zoll, aufbereitung, selbstkosten, fhd_aufschlag_prozent,
      fhd_aufschlag_wert, vk_roh, vk_gesetzt, provision_agent_prozent,
      provision_agent_wert, marge_real, style, composition, gg, material,
      lieferung, lieferant, lieferzeit, produktionszeitraum, frachtzeitraum,
      luftfrachtzuschlag, bemerkungen
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    stmt.run(
      calcId,
      item.item_number,
      parseGermanFloat(item.fob_preis_usd),
      parseGermanFloat(item.kurs),
      parseGermanFloat(item.fob_preis_eur),
      parseGermanFloat(item.fracht),
      parseGermanFloat(item.zoll_prozent),
      parseGermanFloat(item.zoll),
      parseGermanFloat(item.aufbereitung),
      parseGermanFloat(item.selbstkosten),
      parseGermanFloat(item.fhd_aufschlag_prozent),
      parseGermanFloat(item.fhd_aufschlag_wert),
      parseGermanFloat(item.vk_roh),
      parseGermanFloat(item.vk_gesetzt),
      parseGermanFloat(item.provision_agent_prozent),
      parseGermanFloat(item.provision_agent_wert),
      parseGermanFloat(item.marge_real),
      item.style || null,
      item.composition || null,
      item.gg || null,
      item.material || null,
      item.lieferung || null,
      item.lieferant || null,
      item.lieferzeit || null,
      item.produktionszeitraum || null,
      item.frachtzeitraum || null,
      parseGermanFloat(item.luftfrachtzuschlag),
      item.bemerkungen || null
    );
  }
}

// Helper function to insert warehousing data
function insertWarehousingData(calcId, data) {
  db.prepare(`
    INSERT INTO warehousing_data (
      calculation_id, handling_in_entladung, lagerplatz_verbringen,
      kommissionierung_b2b, kommissionierung_b2c, zusatzarbeiten_stunden,
      handling_out, anmeldung_avisierung, lieferscheintasche,
      kartonage1_text, kartonage1_wert, kartonage2_text, kartonage2_wert,
      kartonage3_text, kartonage3_wert, annahme_entsorgung, grobsichtung,
      einhuellen_polybag, rueckfuehrung_bestand, flaeche_m2, preis_m2,
      inventur_stunden, etiketten_drucken_stunden, etikettierung_stunden, bemerkungen
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    calcId,
    parseGermanFloat(data.handling_in_entladung),
    parseGermanFloat(data.lagerplatz_verbringen),
    parseGermanFloat(data.kommissionierung_b2b),
    parseGermanFloat(data.kommissionierung_b2c),
    parseGermanFloat(data.zusatzarbeiten_stunden),
    parseGermanFloat(data.handling_out),
    parseGermanFloat(data.anmeldung_avisierung),
    parseGermanFloat(data.lieferscheintasche),
    data.kartonage1_text || null,
    parseGermanFloat(data.kartonage1_wert),
    data.kartonage2_text || null,
    parseGermanFloat(data.kartonage2_wert),
    data.kartonage3_text || null,
    parseGermanFloat(data.kartonage3_wert),
    parseGermanFloat(data.annahme_entsorgung),
    parseGermanFloat(data.grobsichtung),
    parseGermanFloat(data.einhuellen_polybag),
    parseGermanFloat(data.rueckfuehrung_bestand),
    parseGermanFloat(data.flaeche_m2),
    parseGermanFloat(data.preis_m2),
    parseGermanFloat(data.inventur_stunden),
    parseGermanFloat(data.etiketten_drucken_stunden),
    parseGermanFloat(data.etikettierung_stunden),
    data.bemerkungen || null
  );
}

// ============ OFFERS ROUTES ============

// GET all offers (excludes soft-deleted)
router.get('/offers/all', (req, res) => {
  try {
    const offers = db.prepare(`
      SELECT o.*, u.name as created_by_name
      FROM offers o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `).all();

    res.json(offers.map(offer => ({
      ...offer,
      created_by: offer.created_by_name
    })));
  } catch (error) {
    console.error('GET offers error:', error);
    res.status(500).json({ error: 'Failed to load offers' });
  }
});

// GET offer by ID
router.get('/offers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Auto-generate offer_number for existing offers without one
    if (!offer.offer_number) {
      console.log(`Offer ${id} has no offer_number, generating...`);
      const offerNumber = generateOfferNumber(1);
      console.log(`Updating offer ${id} with offer_number: ${offerNumber}`);
      db.prepare('UPDATE offers SET offer_number = ? WHERE id = ?').run(offerNumber, id);
      offer.offer_number = offerNumber;
    }

    // Get associated offer data
    const result = { ...offer };
    if (offer.offer_type === 'garment') {
      const items = db.prepare('SELECT * FROM garment_offer_data WHERE offer_id = ? ORDER BY item_number ASC').all(id);
      result.items = items;
    } else if (offer.offer_type === 'warehousing') {
      const wh = db.prepare('SELECT * FROM warehousing_offer_data WHERE offer_id = ?').get(id);
      result.warehousing = wh;
    }

    res.json(result);
  } catch (error) {
    console.error('GET offer error:', error);
    res.status(500).json({ error: 'Failed to load offer' });
  }
});

// POST new offer
router.post('/offers', (req, res) => {
  try {
    const data = req.body;
    const offerUuid = uuidv4();
    const offerNumber = generateOfferNumber(1);

    console.log(`Creating new offer with offer_number: ${offerNumber}`);

    const result = db.prepare(`
      INSERT INTO offers (
        offer_uuid, offer_type, source_calculation_id, kunde, customer_name,
        customer_company, customer_street, customer_postal_code, customer_city,
        customer_country, customer_email, customer_phone, created_by,
        valid_until, status, notes, message, delivery_option, snapshot_data,
        offer_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      offerUuid,
      data.offer_type || 'garment',
      data.source_calculation_id || null,
      data.kunde,
      data.customer_name || null,
      data.customer_company || null,
      data.customer_street || null,
      data.customer_postal_code || null,
      data.customer_city || null,
      data.customer_country || null,
      data.customer_email || null,
      data.customer_phone || null,
      req.user.id,
      data.valid_until || null,
      data.status || 'pending',
      data.notes || null,
      data.message || null,
      data.delivery_option || null,
      data.snapshot_data ? JSON.stringify(data.snapshot_data) : null,
      offerNumber
    );

    const offerId = result.lastInsertRowid;

    // Insert offer items based on type
    if (data.offer_type === 'garment' && data.items) {
      const stmt = db.prepare(`
        INSERT INTO garment_offer_data (
          offer_id, item_number, fob_preis_usd, kurs, fob_preis_eur, fracht,
          zoll_prozent, zoll, aufbereitung, selbstkosten, fhd_aufschlag_prozent,
          fhd_aufschlag_wert, vk_roh, vk_gesetzt, provision_agent_prozent,
          provision_agent_wert, marge_real, style, composition, gg, material,
          lieferung, lieferant, lieferzeit, produktionszeitraum, frachtzeitraum,
          luftfrachtzuschlag, bemerkungen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        stmt.run(
          offerId,
          item.item_number,
          parseGermanFloat(item.fob_preis_usd),
          parseGermanFloat(item.kurs),
          parseGermanFloat(item.fob_preis_eur),
          parseGermanFloat(item.fracht),
          parseGermanFloat(item.zoll_prozent),
          parseGermanFloat(item.zoll),
          parseGermanFloat(item.aufbereitung),
          parseGermanFloat(item.selbstkosten),
          parseGermanFloat(item.fhd_aufschlag_prozent),
          parseGermanFloat(item.fhd_aufschlag_wert),
          parseGermanFloat(item.vk_roh),
          parseGermanFloat(item.vk_gesetzt),
          parseGermanFloat(item.provision_agent_prozent),
          parseGermanFloat(item.provision_agent_wert),
          parseGermanFloat(item.marge_real),
          item.style || null,
          item.composition || null,
          item.gg || null,
          item.material || null,
          item.lieferung || null,
          item.lieferant || null,
          item.lieferzeit || null,
          item.produktionszeitraum || null,
          item.frachtzeitraum || null,
          parseGermanFloat(item.luftfrachtzuschlag),
          item.bemerkungen || null
        );
      }
    } else if (data.offer_type === 'warehousing' && data.warehousing) {
      const wh = data.warehousing;
      db.prepare(`
        INSERT INTO warehousing_offer_data (
          offer_id, handling_in_entladung, lagerplatz_verbringen,
          kommissionierung_b2b, kommissionierung_b2c, zusatzarbeiten_stunden,
          handling_out, anmeldung_avisierung, lieferscheintasche,
          kartonage1_text, kartonage1_wert, kartonage2_text, kartonage2_wert,
          kartonage3_text, kartonage3_wert, annahme_entsorgung, grobsichtung,
          einhuellen_polybag, rueckfuehrung_bestand, flaeche_m2, preis_m2,
          inventur_stunden, etiketten_drucken_stunden, etikettierung_stunden, bemerkungen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        offerId,
        parseGermanFloat(wh.handling_in_entladung),
        parseGermanFloat(wh.lagerplatz_verbringen),
        parseGermanFloat(wh.kommissionierung_b2b),
        parseGermanFloat(wh.kommissionierung_b2c),
        parseGermanFloat(wh.zusatzarbeiten_stunden),
        parseGermanFloat(wh.handling_out),
        parseGermanFloat(wh.anmeldung_avisierung),
        parseGermanFloat(wh.lieferscheintasche),
        wh.kartonage1_text || null,
        parseGermanFloat(wh.kartonage1_wert),
        wh.kartonage2_text || null,
        parseGermanFloat(wh.kartonage2_wert),
        wh.kartonage3_text || null,
        parseGermanFloat(wh.kartonage3_wert),
        parseGermanFloat(wh.annahme_entsorgung),
        parseGermanFloat(wh.grobsichtung),
        parseGermanFloat(wh.einhuellen_polybag),
        parseGermanFloat(wh.rueckfuehrung_bestand),
        parseGermanFloat(wh.flaeche_m2),
        parseGermanFloat(wh.preis_m2),
        parseGermanFloat(wh.inventur_stunden),
        parseGermanFloat(wh.etiketten_drucken_stunden),
        parseGermanFloat(wh.etikettierung_stunden),
        wh.bemerkungen || null
      );
    }

    // Log the action
    logAction('CREATE', 'offer', offerId, offerUuid, req.user, {
      kunde: data.kunde,
      offer_type: data.offer_type || 'garment'
    });

    res.json({
      id: offerId,
      success: true,
      offer_uuid: offerUuid,
      message: 'Offer created successfully'
    });
  } catch (error) {
    console.error('POST offer error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// DELETE offer (soft delete)
router.delete('/offers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get offer info for logging
    const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

    // Soft delete
    db.prepare("UPDATE offers SET deleted_at = datetime('now') WHERE id = ?").run(id);

    // Log the action
    logAction('DELETE', 'offer', id, offer?.offer_uuid, req.user, {
      kunde: offer?.kunde,
      offer_type: offer?.offer_type
    });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('DELETE offer error:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// POST send offer email
router.post('/offers/:id/send-email', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { pdfBase64, subject, message, recipient } = req.body;

    // Get offer details
    const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Use provided recipient or fall back to customer_email
    const recipientEmail = recipient || offer.customer_email;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'No recipient email address provided' });
    }

    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Prepare email content
    const customerName = offer.customer_name || offer.customer_company || offer.kunde;
    const emailSubject = subject || `Angebot von Fashion Holding Düsseldorf - ${offer.offer_number || offer.id}`;

    const defaultMessage = `Sehr geehrte/r ${customerName},

anbei erhalten Sie unser Angebot wie besprochen.

Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
Fashion Holding Düsseldorf GmbH`;

    const emailText = message || offer.message || defaultMessage;

    const mailOptions = {
      from: `"FHD Agency" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: emailText,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
        ${emailText.split('\n').map(line => `<p style="margin: 0 0 10px 0;">${line || '&nbsp;'}</p>`).join('')}
      </div>`,
      attachments: pdfBase64 ? [{
        filename: `Angebot_${offer.offer_number || offer.id}.pdf`,
        content: pdfBase64,
        encoding: 'base64'
      }] : []
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Update offer status to sent
    db.prepare("UPDATE offers SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(id);

    // Log the action
    logAction('SEND_EMAIL', 'offer', id, offer.offer_uuid, req.user, {
      kunde: offer.kunde,
      recipient: recipientEmail
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      recipient: recipientEmail
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email: ' + error.message });
  }
});

// ============ ADMIN ROUTES ============

// Track failed admin verification attempts per user
const adminVerificationAttempts = new Map();

// POST verify calculation admin password
router.post('/admin/verify', async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    // Rate limiting
    const userAttempts = adminVerificationAttempts.get(userId) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    const lockoutDuration = 15 * 60 * 1000;
    const maxAttempts = 5;

    if (now - userAttempts.lastAttempt > lockoutDuration) {
      userAttempts.count = 0;
    }

    if (userAttempts.count >= maxAttempts) {
      const remainingTime = Math.ceil((lockoutDuration - (now - userAttempts.lastAttempt)) / 60000);
      return res.status(429).json({
        error: `Zu viele Fehlversuche. Bitte warten Sie ${remainingTime} Minuten.`
      });
    }

    if (!password) {
      return res.status(400).json({ error: 'Passwort erforderlich' });
    }

    const bcrypt = await import('bcryptjs');
    const storedPassword = process.env.CALC_ADMIN_PASSWORD_HASH || process.env.CALC_ADMIN_PASSWORD;

    let isValid = false;
    if (storedPassword && storedPassword.startsWith('$2')) {
      isValid = await bcrypt.default.compare(password, storedPassword);
    } else if (storedPassword) {
      isValid = password === storedPassword;
    }

    if (!isValid) {
      userAttempts.count += 1;
      userAttempts.lastAttempt = now;
      adminVerificationAttempts.set(userId, userAttempts);

      const remainingAttempts = maxAttempts - userAttempts.count;
      return res.status(401).json({
        error: 'Falsches Passwort',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
      });
    }

    adminVerificationAttempts.delete(userId);

    logAction('ADMIN_ACCESS', 'admin_panel', null, null, req.user, {
      ip: req.ip || req.connection?.remoteAddress
    });

    res.json({ success: true, message: 'Admin-Bereich freigeschaltet' });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET activity logs (admin only)
router.get('/admin/logs', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const logs = db.prepare(`
      SELECT * FROM calculation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);

    const totalResult = db.prepare('SELECT COUNT(*) as count FROM calculation_logs').get();

    res.json({
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      })),
      total: totalResult.count,
      limit,
      offset
    });
  } catch (error) {
    console.error('GET logs error:', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

// GET database export (admin only)
router.get('/admin/export', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all data
    const calculations = db.prepare(`
      SELECT c.*, u.name as created_by_name, u.email as created_by_email
      FROM calculations c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
    `).all();

    const garmentData = db.prepare('SELECT * FROM garment_data ORDER BY calculation_id, item_number').all();
    const warehousingData = db.prepare('SELECT * FROM warehousing_data').all();

    const offers = db.prepare(`
      SELECT o.*, u.name as created_by_name, u.email as created_by_email
      FROM offers o
      LEFT JOIN users u ON o.created_by = u.id
      ORDER BY o.created_at DESC
    `).all();

    const garmentOfferData = db.prepare('SELECT * FROM garment_offer_data ORDER BY offer_id, item_number').all();
    const warehousingOfferData = db.prepare('SELECT * FROM warehousing_offer_data').all();
    const logs = db.prepare('SELECT * FROM calculation_logs ORDER BY created_at DESC').all();

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: req.user.name,
      calculations: calculations.map(calc => {
        const items = garmentData.filter(g => g.calculation_id === calc.id);
        const warehousing = warehousingData.find(w => w.calculation_id === calc.id);
        return {
          ...calc,
          items: items.length > 0 ? items : undefined,
          warehousing: warehousing || undefined
        };
      }),
      offers: offers.map(offer => {
        const items = garmentOfferData.filter(g => g.offer_id === offer.id);
        const warehousing = warehousingOfferData.find(w => w.offer_id === offer.id);
        return {
          ...offer,
          items: items.length > 0 ? items : undefined,
          warehousing: warehousing || undefined
        };
      }),
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      })),
      summary: {
        totalCalculations: calculations.length,
        activeCalculations: calculations.filter(c => !c.deleted_at).length,
        deletedCalculations: calculations.filter(c => c.deleted_at).length,
        totalOffers: offers.length,
        activeOffers: offers.filter(o => !o.deleted_at).length,
        deletedOffers: offers.filter(o => o.deleted_at).length,
        totalLogs: logs.length
      }
    };

    logAction('EXPORT', 'database', null, null, req.user, {
      totalCalculations: exportData.summary.totalCalculations,
      totalOffers: exportData.summary.totalOffers
    });

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

export default router;
