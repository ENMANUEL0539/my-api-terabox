const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// El endpoint de tu API
app.get('/api/preview', async (req, res) => {
  // Habilita CORS para que cualquier web pueda llamar a tu API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return res.status(404).json({ error: `Failed to fetch URL: ${response.statusText}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Contenido Exclusivo';
    title = title.replace(/\s-\sTeraBox.*$/i, '').trim();

    let description = $('meta[property="og:description"]').attr('content') || 'Accede al contenido exclusivo alojado en TeraBox.';

    let image = $('meta[property="og:image"]').attr('content');
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, url).toString();
      } catch (e) {
        image = null;
      }
    }

    return res.status(200).json({
      success: true,
      title,
      description,
      image: image || 'https://via.placeholder.com/600x400.png?text=Preview+No+Disponible' // Imagen por defecto
    });

  } catch (error) {
    console.error('Error en preview.js:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching preview.',
      message: error.message
    });
  }
});

// Inicia el servidor
app.listen(port, () => console.log(`API listening on port ${port}`));
