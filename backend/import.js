const db = require('./db');
const fs = require('fs');
const path = require('path');

// Maps the "field" column in the CSV to your domain types
function getDomain(field) {
  if (!field) return 'engineering';
  const f = field.toLowerCase();
  if (f.includes('engineering')) return 'engineering';
  if (f.includes('management') || f.includes('mba')) return 'management';
  if (f.includes('medical') || f.includes('pharmacy')) return 'medical';
  if (f.includes('law')) return 'law';
  if (f.includes('design') || f.includes('architecture')) return 'design';
  if (f.includes('university')) return 'engineering';
  return 'engineering';
}

// Maps college name to type
function getCollegeType(name, instituteId) {
  if (!name) return 'private';
  const n = name.toLowerCase();
  const id = (instituteId || '').toLowerCase();
  if (n.includes('indian institute of technology') || n.startsWith('iit ')) return 'IIT';
  if (n.includes('national institute of technology') || n.startsWith('nit ')) return 'NIT';
  if (n.includes('indian institute of management') || n.startsWith('iim ')) return 'IIM';
  if (n.includes('indian institute of information technology') || n.startsWith('iiit ')) return 'IIIT';
  if (n.includes('aiims') || n.includes('all india institute of medical')) return 'deemed';
  if (id.startsWith('ir-e-u') || id.startsWith('ir-m-u') || id.startsWith('ir-u')) return 'state';
  if (id.startsWith('ir-e-c') || id.startsWith('ir-m-c')) return 'private';
  return 'private';
}

// Parse CSV line handling quoted commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function importNIRF() {
  try {
    console.log('Starting NIRF import...');

    // Try to find the CSV file
    const possibleNames = [
      'NIRF Ranking 2024.csv',
      'nirf_ranking_2024.csv',
      'nirf.csv',
      'NIRF.csv',
      'archive/NIRF Ranking 2024.csv'
    ];

    let filePath = null;
    for (const name of possibleNames) {
      const p = path.join(__dirname, name);
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      console.log('CSV file not found! Please copy it to your /backend folder');
      console.log('Looking for any of these:', possibleNames);
      process.exit(1);
    }

    console.log(`Found file: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    console.log('CSV Headers found:', headers);
    console.log(`Total rows to process: ${lines.length - 1}`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ? values[idx].replace(/"/g, '').trim() : null;
      });

      // Skip if no name
      if (!row.name) continue;

      // Check if already exists
      const [existing] = await db.query(
        'SELECT id FROM colleges WHERE name = ?', [row.name]
      );

      if (existing.length > 0) {
        skipCount++;
        continue;
      }

      const collegeType = getCollegeType(row.name, row.institute_id);
      const domain = getDomain(row.field);
      const nirfRank = row.rank && !isNaN(row.rank) ? parseInt(row.rank) : null;
      const score = row.score && !isNaN(row.score) ? parseFloat(row.score) : null;

      // Estimate fees based on college type (since CSV doesn't have fees)
      const feesMap = {
        'IIT': 220000,
        'NIT': 145000,
        'IIIT': 200000,
        'IIM': 1100000,
        'state': 50000,
        'deemed': 400000,
        'private': 250000
      };
      const fees = feesMap[collegeType] || 200000;

      try {
        await db.query(`
          INSERT INTO colleges 
            (name, city, state, country, type, nirf_rank, fees_per_year, website, about)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.name,
          row.city || null,
          row.state || null,
          'India',
          collegeType,
          nirfRank,
          fees,
          null,
          `NIRF ${row.field || 'Engineering'} Rank ${nirfRank || 'N/A'} | Score: ${score || 'N/A'}`
        ]);

        console.log(`[${i}] Imported: ${row.name} (${collegeType}, Rank ${nirfRank})`);
        successCount++;

      } catch (err) {
        console.log(`[${i}] Error importing ${row.name}: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n=============================');
    console.log(`Done!`);
    console.log(`Imported:  ${successCount} colleges`);
    console.log(`Skipped:   ${skipCount} (already existed)`);
    console.log(`Errors:    ${errorCount}`);
    console.log('=============================');

    // Show total count
    const [total] = await db.query('SELECT COUNT(*) as count FROM colleges');
    console.log(`Total colleges in database: ${total[0].count}`);

    process.exit(0);

  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
}

importNIRF();