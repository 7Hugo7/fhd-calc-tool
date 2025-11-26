import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'database.json');

// Default database structure
const defaultData = {
  users: [],
  calculations: [],
  garment_data: [],
  warehousing_data: [],
  offers: [],
  garment_offer_data: [],
  warehousing_offer_data: [],
  calculation_logs: [],
  counters: {
    calculations: 0,
    garment_data: 0,
    warehousing_data: 0,
    offers: 0,
    garment_offer_data: 0,
    warehousing_offer_data: 0,
    calculation_logs: 0,
    users: 0
  }
};

// In-memory database
let data = null;

// Load database from file
function loadDatabase() {
  try {
    if (fs.existsSync(dbPath)) {
      const rawData = fs.readFileSync(dbPath, 'utf-8');
      data = JSON.parse(rawData);
      // Ensure counters exist
      if (!data.counters) {
        data.counters = { ...defaultData.counters };
      }
    } else {
      data = JSON.parse(JSON.stringify(defaultData));
      saveDatabase();
    }
  } catch (error) {
    console.error('Error loading database:', error);
    data = JSON.parse(JSON.stringify(defaultData));
    saveDatabase();
  }
}

// Save database to file
function saveDatabase() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Initialize database
export function initializeDatabase() {
  loadDatabase();
  console.log('Database initialized');
}

// Helper to get next ID for a table
function getNextId(table) {
  if (!data.counters) data.counters = {};
  data.counters[table] = (data.counters[table] || 0) + 1;
  return data.counters[table];
}

// Parse a SQL value token
function parseValueToken(token, params, paramIndex) {
  token = token.trim();

  // Parameter placeholder
  if (token === '?') {
    return { value: params[paramIndex.current++], usedParam: true };
  }

  // datetime('now') function
  if (token.toLowerCase().includes("datetime('now')") || token.toLowerCase().includes('datetime("now")')) {
    return { value: new Date().toISOString(), usedParam: false };
  }

  // NULL
  if (token.toLowerCase() === 'null') {
    return { value: null, usedParam: false };
  }

  // String literal
  if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
    return { value: token.slice(1, -1), usedParam: false };
  }

  // Number
  const num = parseFloat(token);
  if (!isNaN(num)) {
    return { value: num, usedParam: false };
  }

  // Default - treat as string
  return { value: token, usedParam: false };
}

// Database wrapper that mimics better-sqlite3 API
const db = {
  // Prepare a statement (returns object with run, get, all methods)
  prepare(sql) {
    return {
      sql,
      run(...params) {
        return executeStatement(sql, params, 'run');
      },
      get(...params) {
        return executeStatement(sql, params, 'get');
      },
      all(...params) {
        return executeStatement(sql, params, 'all');
      }
    };
  },

  // Execute raw SQL
  exec(sql) {
    // For initialization, we just ensure data is loaded
    loadDatabase();
  },

  // Pragma (no-op for JSON)
  pragma() {}
};

// Execute a prepared statement
function executeStatement(sql, params, mode) {
  // Ensure data is loaded
  if (!data) loadDatabase();

  const sqlLower = sql.toLowerCase().trim();

  // Parse INSERT statements
  if (sqlLower.startsWith('insert into')) {
    return handleInsert(sql, params);
  }

  // Parse SELECT statements
  if (sqlLower.startsWith('select')) {
    const results = handleSelect(sql, params);
    return mode === 'get' ? results[0] || null : results;
  }

  // Parse UPDATE statements
  if (sqlLower.startsWith('update')) {
    return handleUpdate(sql, params);
  }

  // Parse DELETE statements
  if (sqlLower.startsWith('delete from')) {
    return handleDelete(sql, params);
  }

  return mode === 'all' ? [] : null;
}

// Handle INSERT statements
function handleInsert(sql, params) {
  const tableMatch = sql.match(/insert into (\w+)/i);
  if (!tableMatch) return { lastInsertRowid: 0, changes: 0 };

  const tableName = tableMatch[1];

  // Parse columns from SQL - handle multiline
  const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
  if (!columnsMatch) return { lastInsertRowid: 0, changes: 0 };

  const columns = columnsMatch[1].split(',').map(c => c.trim());

  // Parse values from SQL
  const valuesMatch = sql.match(/values\s*\((.+)\)/is);
  if (!valuesMatch) return { lastInsertRowid: 0, changes: 0 };

  // Split values carefully (respecting parentheses in function calls)
  const valuesStr = valuesMatch[1];
  const valueTokens = [];
  let currentToken = '';
  let parenDepth = 0;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    if (char === '(') {
      parenDepth++;
      currentToken += char;
    } else if (char === ')') {
      parenDepth--;
      currentToken += char;
    } else if (char === ',' && parenDepth === 0) {
      valueTokens.push(currentToken.trim());
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  if (currentToken.trim()) {
    valueTokens.push(currentToken.trim());
  }

  // Build record
  const record = { id: getNextId(tableName) };
  const paramIndex = { current: 0 };

  columns.forEach((col, idx) => {
    if (idx < valueTokens.length) {
      const parsed = parseValueToken(valueTokens[idx], params, paramIndex);
      record[col] = parsed.value;
    } else {
      record[col] = null;
    }
  });

  // Add created_at if not set and not in columns
  if (record.created_at === undefined) {
    record.created_at = new Date().toISOString();
  }

  if (!data[tableName]) {
    data[tableName] = [];
  }
  data[tableName].push(record);
  saveDatabase();

  return { lastInsertRowid: record.id, changes: 1 };
}

// Handle SELECT statements
function handleSelect(sql, params) {
  const tableMatch = sql.match(/from (\w+)/i);
  if (!tableMatch) return [];

  const tableName = tableMatch[1];
  let results = [...(data[tableName] || [])];

  // Handle JOINs (basic support)
  const joinMatch = sql.match(/left join (\w+)\s+(\w+)\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
  if (joinMatch) {
    const joinTable = joinMatch[1];
    const joinAlias = joinMatch[2];
    const leftTable = joinMatch[3];
    const leftField = joinMatch[4];
    const rightTable = joinMatch[5];
    const rightField = joinMatch[6];

    const joinData = data[joinTable] || [];

    results = results.map(record => {
      const joinRecord = joinData.find(jr => jr[rightField] === record[leftField]);
      if (joinRecord) {
        // Add joined fields with table prefix
        const merged = { ...record };
        Object.keys(joinRecord).forEach(key => {
          merged[`${joinAlias}_${key}`] = joinRecord[key];
        });
        // Also check for specific field aliases in SELECT
        if (sql.includes(`${joinAlias}.name as created_by_name`)) {
          merged.created_by_name = joinRecord.name;
        }
        return merged;
      }
      return record;
    });
  }

  // Handle WHERE clause
  const whereMatch = sql.match(/where (.+?)(?:\s+order\s+by|\s+limit|\s*$)/is);
  if (whereMatch) {
    results = filterByWhere(results, whereMatch[1], params);
  }

  // Handle ORDER BY
  const orderMatch = sql.match(/order by (\w+)\s*(asc|desc)?/i);
  if (orderMatch) {
    const orderField = orderMatch[1];
    const orderDir = (orderMatch[2] || 'asc').toLowerCase();
    results.sort((a, b) => {
      const aVal = a[orderField];
      const bVal = b[orderField];
      if (aVal < bVal) return orderDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return orderDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Handle LIMIT
  const limitMatch = sql.match(/limit (\d+)/i);
  if (limitMatch) {
    results = results.slice(0, parseInt(limitMatch[1]));
  }

  return results;
}

// Handle UPDATE statements
function handleUpdate(sql, params) {
  const tableMatch = sql.match(/update (\w+)/i);
  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1];

  // Parse SET clause
  const setMatch = sql.match(/set (.+?) where/is);
  if (!setMatch) return { changes: 0 };

  // Parse WHERE clause
  const whereMatch = sql.match(/where (.+?)$/is);
  if (!whereMatch) return { changes: 0 };

  // Parse SET assignments
  const setStr = setMatch[1];
  const assignments = [];
  let currentAssignment = '';
  let parenDepth = 0;

  for (let i = 0; i < setStr.length; i++) {
    const char = setStr[i];
    if (char === '(') {
      parenDepth++;
      currentAssignment += char;
    } else if (char === ')') {
      parenDepth--;
      currentAssignment += char;
    } else if (char === ',' && parenDepth === 0) {
      assignments.push(currentAssignment.trim());
      currentAssignment = '';
    } else {
      currentAssignment += char;
    }
  }
  if (currentAssignment.trim()) {
    assignments.push(currentAssignment.trim());
  }

  // Build updates object
  const paramIndex = { current: 0 };
  const updates = {};

  assignments.forEach(assignment => {
    const eqIdx = assignment.indexOf('=');
    if (eqIdx > -1) {
      const field = assignment.substring(0, eqIdx).trim();
      const valueStr = assignment.substring(eqIdx + 1).trim();
      const parsed = parseValueToken(valueStr, params, paramIndex);
      updates[field] = parsed.value;
    }
  });

  // Remaining params are for WHERE clause
  const whereParams = params.slice(paramIndex.current);
  let changes = 0;

  if (data[tableName]) {
    data[tableName] = data[tableName].map(record => {
      if (matchesWhere(record, whereMatch[1], whereParams)) {
        changes++;
        return { ...record, ...updates };
      }
      return record;
    });
    saveDatabase();
  }

  return { changes };
}

// Handle DELETE statements
function handleDelete(sql, params) {
  const tableMatch = sql.match(/delete from (\w+)/i);
  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1];

  // Parse WHERE clause
  const whereMatch = sql.match(/where (.+?)$/is);
  if (!whereMatch) return { changes: 0 };

  const originalLength = (data[tableName] || []).length;
  data[tableName] = (data[tableName] || []).filter(
    record => !matchesWhere(record, whereMatch[1], params)
  );
  saveDatabase();

  return { changes: originalLength - data[tableName].length };
}

// Filter records by WHERE clause
function filterByWhere(records, whereClause, params) {
  return records.filter(record => matchesWhere(record, whereClause, params));
}

// Check if record matches WHERE clause
function matchesWhere(record, whereClause, params) {
  const conditions = whereClause.split(/\s+and\s+/i);
  let paramIndex = 0;

  for (const condition of conditions) {
    const condTrimmed = condition.trim();

    // Handle IS NULL
    const isNullMatch = condTrimmed.match(/(\w+)\s+is\s+null/i);
    if (isNullMatch) {
      if (record[isNullMatch[1]] !== null && record[isNullMatch[1]] !== undefined) {
        return false;
      }
      continue;
    }

    // Handle IS NOT NULL
    const isNotNullMatch = condTrimmed.match(/(\w+)\s+is\s+not\s+null/i);
    if (isNotNullMatch) {
      if (record[isNotNullMatch[1]] === null || record[isNotNullMatch[1]] === undefined) {
        return false;
      }
      continue;
    }

    // Handle = comparisons (field = ? or field = value)
    const eqMatch = condTrimmed.match(/(\w+)\s*=\s*(\?|[\d.]+|'[^']*'|"[^"]*")/);
    if (eqMatch) {
      const field = eqMatch[1];
      let value;

      if (eqMatch[2] === '?') {
        value = params[paramIndex++];
      } else if (eqMatch[2].startsWith("'") || eqMatch[2].startsWith('"')) {
        value = eqMatch[2].slice(1, -1);
      } else {
        value = parseFloat(eqMatch[2]);
        if (isNaN(value)) value = parseInt(eqMatch[2]);
      }

      // Handle integer booleans (SQLite style: 0/1)
      const recordValue = record[field];
      if (typeof value === 'number' && (value === 0 || value === 1)) {
        if (recordValue !== value && recordValue !== Boolean(value)) {
          return false;
        }
      } else if (recordValue != value) {
        return false;
      }
      continue;
    }
  }

  return true;
}

export default db;
