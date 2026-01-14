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
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Endpoint para obtener la vista previa
app.get('/api/preview', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log(`[API] Fetching preview for: ${url}`); // Log para depuración

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/'
      },
    });

    if (!response.ok) {
      console.error(`[API] Failed to fetch URL: ${response.status} ${response.statusText}`);
      return res.status(404).json({ error: `Failed to fetch URL: ${response.statusText}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- EXTRAER TÍTULO ---
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                'Contenido Exclusivo';
    title = title.replace(/\s-\sTeraBox.*$/i, '').trim();

    // --- EXTRAER DESCRIPCIÓN ---
    let description = $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content') ||
                      $('meta[name="description"]').attr('content') ||
                      'Accede al contenido exclusivo alojado en TeraBox.';

    // --- EXTRAER IMAGEN (MÉTODO MEJORADO) ---
    let image = null;

    // 1. Intentar con las metaetiquetas estándar (Open Graph, Twitter)
    image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('link[rel="image_src"]').attr('content');

    // 2. Si no funciona, buscar en contenedores específicos de TeraBox
    if (!image) {
        const selectorsToTry = [
            '.file-list img',          // Lista de archivos
            '.share-file img',         // Archivo compartido
            '.preview-img img',        // Imagen de vista previa
            '.img-preview img',        // Otra posible clase de preview
            '.thumbnail img'           // Miniatura
        ];
        for (const selector of selectorsToTry) {
            const foundImg = $(selector).first();
            if (foundImg.length && foundImg.attr('src')) {
                image = foundImg.attr('src');
                console.log(`[API] Found image using selector: ${selector}`);
                break; // Detenerse al encontrar la primera
            }
        }
    }

    // 3. Si aún no hay imagen, buscar la primera imagen que tenga un src razonable
    if (!image) {
        const allImages = $('img[src]');
        for (let i = 0; i < allImages.length; i++) {
            const src = $(allImages[i]).attr('src');
            // Ignorar iconos, espaciadores o imágenes muy pequeñas
            if (src && !src.includes('icon') && !src.includes('spacer') && (src.includes('.jpg') || src.includes('.png') || src.includes('.jpeg'))) {
                image = src;
                console.log(`[API] Found fallback image: ${src}`);
                break;
            }
        }
    }
    
    // Convertir URLs relativas a absolutas
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, url).toString();
      } catch (e) {
        console.error('[API] Error converting relative URL to absolute:', e);
        image = null;
      }
    }

    console.log(`[API] Final image URL found: ${image}`);

    // Usar un placeholder más simple y fiable
    const placeholderImage = 'https://placehold.co/600x400.png?text=Vista+Previa+No+Disponible';

    return res.status(200).json({
      success: true,
      title,
      description,
      image: image || placeholderImage
    });

  } catch (error) {
    console.error('[API] Critical error in preview.js:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching preview.',
      message: error.message
    });
  }
});

// Endpoint para servir imágenes como proxy (sin cambios)
app.get('/api/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL parameter is required');

    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://1024terabox.com/'
      }
    });

    if (!imageResponse.ok) return res.status(404).send('Image not found');
    
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    const imageBuffer = await imageResponse.buffer();
    res.send(imageBuffer);

  } catch (error) {
    console.error('[API] Error fetching image proxy:', error);
    res.status(500).send('Error fetching image');
  }
});

app.listen(port, () => console.log(`API listening on port ${port}`));
