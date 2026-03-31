/**
 * TikTok S2S Postback Handler
 * Receives conversions from affiliate network and sends to TikTok Events API
 * 
 * Deploy to: /api/postback-tiktok.js on Vercel
 */

import fetch from 'node-fetch';

// Configuration
const CONFIG = {
  TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN || '1695a3cd596550e34c5b8586130b08cfb7326038',
  TIKTOK_EVENT_SET_ID: process.env.TIKTOK_EVENT_SET_ID || '7623547706669023250',
  TIKTOK_API_URL: 'https://business-api.tiktok.com/open_api/v1.3/event/track/',
};

/**
 * Hash email or phone for TikTok (SHA256)
 */
async function hashValue(value) {
  if (!value) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send conversion to TikTok Events API
 */
async function sendToTikTok(conversionData) {
  try {
    const {
      conversion_id,
      conversion_date,
      offer_id,
      offer_name,
      price,
      disposition,
      email,
      phone,
      user_id,
      tiktok_click_id
    } = conversionData;

    // Hash user identifiers
    const hashedEmail = email ? await hashValue(email) : null;
    const hashedPhone = phone ? await hashValue(phone) : null;

    // Build TikTok event payload
    const payload = {
      data: [{
        event: 'Purchase',
        event_id: `conversion_${conversion_id}`,
        timestamp: Math.floor(new Date(conversion_date).getTime() / 1000),
        user: {
          ...(hashedEmail && { email: hashedEmail }),
          ...(hashedPhone && { phone: hashedPhone }),
          ...(user_id && { external_id: String(user_id) })
        },
        value: parseFloat(price) || 0,
        currency: 'USD',
        properties: {
          offer_id: String(offer_id),
          offer_name: offer_name,
          disposition: disposition,
          ...(tiktok_click_id && { tiktok_click_id: tiktok_click_id })
        }
      }],
      event_source: 'crm',
      event_source_id: CONFIG.TIKTOK_EVENT_SET_ID
    };

    // Send to TikTok
    const response = await fetch(CONFIG.TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': CONFIG.TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Conversion ${conversion_id} sent to TikTok successfully`);
      return { success: true, conversion_id, tiktok_response: result };
    } else {
      console.error(`❌ TikTok API error for conversion ${conversion_id}:`, result);
      return { success: false, conversion_id, error: result };
    }
  } catch (error) {
    console.error(`❌ Error sending conversion to TikTok:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main API handler - receives postback from affiliate network
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const conversionData = req.body;

    // Validate required fields
    if (!conversionData.conversion_id) {
      return res.status(400).json({ error: 'Missing conversion_id' });
    }

    // Send to TikTok
    const result = await sendToTikTok(conversionData);

    if (result.success) {
      return res.status(200).json({
        status: 'success',
        message: 'Conversion sent to TikTok',
        conversion_id: result.conversion_id
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send conversion to TikTok',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Postback handler error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
}
