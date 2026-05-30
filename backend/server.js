const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
const collegeRoutes = require('./routes/colleges');
app.use('/colleges', collegeRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'College Finder API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});