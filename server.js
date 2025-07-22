const express = require('express');
const { checkWebsites } = require('./monitor');
require('dotenv').config();

const app = express();
app.get('/run-check', async (req, res) => {
  await checkWebsites();
  res.send('✅ Check complete');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`App live on port ${PORT}`));