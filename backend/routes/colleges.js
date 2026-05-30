const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /colleges — search & filter with pagination
router.get('/', async (req, res) => {
  try {
    const { exam, percentile, domain, type, country } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT
        c.id,
        c.name,
        c.city,
        c.state,
        c.country,
        c.type,
        c.nirf_rank,
        c.fees_per_year,
        p.avg_package_lpa,
        p.highest_package_lpa,
        p.placement_percentage,
        ct.min_percentile,
        ct.max_percentile,
        e.name AS exam_name,
        cf.has_hostel,
        cf.has_international_exchange,
        cf.research_score
      FROM colleges c
      LEFT JOIN placements p ON c.id = p.college_id
      LEFT JOIN cutoffs ct ON c.id = ct.college_id
      LEFT JOIN exams e ON ct.exam_id = e.id
      LEFT JOIN college_factors cf ON c.id = cf.college_id
      LEFT JOIN college_courses cc ON c.id = cc.college_id
      LEFT JOIN courses co ON cc.course_id = co.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM colleges c
      LEFT JOIN cutoffs ct ON c.id = ct.college_id
      LEFT JOIN exams e ON ct.exam_id = e.id
      LEFT JOIN college_courses cc ON c.id = cc.college_id
      LEFT JOIN courses co ON cc.course_id = co.id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];

    if (exam) {
      query += ` AND e.name = ?`;
      countQuery += ` AND e.name = ?`;
      params.push(exam);
      countParams.push(exam);
    }

    if (percentile) {
      query += ` AND ct.min_percentile <= ? AND ct.max_percentile >= ?`;
      countQuery += ` AND ct.min_percentile <= ? AND ct.max_percentile >= ?`;
      params.push(percentile, percentile);
      countParams.push(percentile, percentile);
    }

    if (domain) {
      query += ` AND co.domain = ?`;
      countQuery += ` AND co.domain = ?`;
      params.push(domain);
      countParams.push(domain);
    }

    if (type) {
      query += ` AND c.type = ?`;
      countQuery += ` AND c.type = ?`;
      params.push(type);
      countParams.push(type);
    }

    if (country) {
      query += ` AND c.country = ?`;
      countQuery += ` AND c.country = ?`;
      params.push(country);
      countParams.push(country);
    }

    query += ` ORDER BY c.nirf_rank ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /colleges/exams/all — MUST be before /:id
router.get('/exams/all', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM exams`);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /colleges/:id — single college full detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [college] = await db.query(
      `SELECT * FROM colleges WHERE id = ?`, [id]
    );

    if (college.length === 0) {
      return res.status(404).json({ success: false, error: 'College not found' });
    }

    const [placements] = await db.query(
      `SELECT * FROM placements WHERE college_id = ? ORDER BY year DESC`, [id]
    );

    const [cutoffs] = await db.query(
      `SELECT ct.*, e.name AS exam_name
       FROM cutoffs ct
       JOIN exams e ON ct.exam_id = e.id
       WHERE ct.college_id = ?
       ORDER BY ct.year DESC`, [id]
    );

    const [courses] = await db.query(
      `SELECT co.* FROM courses co
       JOIN college_courses cc ON co.id = cc.course_id
       WHERE cc.college_id = ?`, [id]
    );

    const [factors] = await db.query(
      `SELECT * FROM college_factors WHERE college_id = ?`, [id]
    );

    res.json({
      success: true,
      data: {
        ...college[0],
        placements,
        cutoffs,
        courses,
        factors: factors[0] || {}
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /colleges/compare — compare 2 or 3 colleges
router.post('/compare', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || ids.length < 2 || ids.length > 3) {
      return res.status(400).json({
        success: false,
        error: 'Please provide 2 or 3 college IDs to compare'
      });
    }

    const placeholders = ids.map(() => '?').join(',');

    const [colleges] = await db.query(
      `SELECT c.*,
        p.avg_package_lpa, p.highest_package_lpa, p.placement_percentage,
        ct.min_percentile, ct.max_percentile, e.name AS exam_name,
        cf.has_hostel, cf.has_international_exchange, cf.research_score, cf.campus_size_acres
       FROM colleges c
       LEFT JOIN placements p ON c.id = p.college_id
       LEFT JOIN cutoffs ct ON c.id = ct.college_id
       LEFT JOIN exams e ON ct.exam_id = e.id
       LEFT JOIN college_factors cf ON c.id = cf.college_id
       WHERE c.id IN (${placeholders})`, ids
    );

    res.json({ success: true, data: colleges });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;