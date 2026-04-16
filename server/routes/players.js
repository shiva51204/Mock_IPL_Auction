const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all players with optional filters
// Query params: role, set, nationality, search
router.get('/', (req, res) => {
  const { role, set, nationality, search } = req.query;
  let query = 'SELECT * FROM players WHERE 1=1';
  const params = [];

  if (role) { query += ' AND role = ?'; params.push(role); }
  if (set) { query += ' AND set_name = ?'; params.push(set); }
  if (nationality) { query += ' AND nationality = ?'; params.push(nationality); }
  if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }

  query += ' ORDER BY name ASC';

  const players = db.prepare(query).all(...params);
  res.json(players);
});

// GET distinct filter options
router.get('/meta', (req, res) => {
  const roles = db.prepare('SELECT DISTINCT role FROM players ORDER BY role').all().map(r => r.role);
  const sets = db.prepare('SELECT DISTINCT set_name FROM players ORDER BY set_name').all().map(s => s.set_name);
  const nationalities = db.prepare('SELECT DISTINCT nationality FROM players ORDER BY nationality').all().map(n => n.nationality);
  res.json({ roles, sets, nationalities });
});

module.exports = router;
