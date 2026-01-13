const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Endpoint para obtener la vista previa
app.get('/api/preview', async (req, res) => {
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
    
    // Si no hay imagen, buscar la primera imagen en el contenido
    if (!image) {
      const firstImg = $('img').first();
      if (firstImg.length) {
        image = firstImg.attr('src');
      }
    }
    
    // Convertir URLs relativas a absolutas
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, url).toString();
      } catch (e) {
        image = null;
      }
    }

    // Usar el nuevo servicio de placeholder
    const placeholderImage = 'https://placehold.co/600x400@2x.png?text=Preview+No+Disponible';

    return res.status(200).json({
      success: true,
      title,
      description,
      image: image || placeholderImage
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

// Endpoint para servir imágenes como proxy (evita CORB)
app.get('/api/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }

    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': 'https://1024terabox.com/'
      }
    });

    if (!imageResponse.ok) {
      return res.status(404).send('Image not found');
    }

    // Obtener el tipo de contenido de la imagen
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Establecer el tipo de contenido y enviar la imagen
    res.set('Content-Type', contentType);
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Convertir la imagen a buffer y enviarla
    const imageBuffer = await imageResponse.buffer();
    res.send(imageBuffer);

  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).send('Error fetching image');
  }
});

app.listen(port, () => console.log(`API listening on port ${port}`));
