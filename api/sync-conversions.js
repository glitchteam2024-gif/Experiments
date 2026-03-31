/**
 * TikTok Conversion Sync - Runs every 15 minutes
 * Pulls approved conversions from affiliate network and sends to TikTok
 * 
 * Deploy to: /api/sync-conversions.js on Vercel
 * Set up cron job: 0 */15 * * * * (every 15 minutes)
 */

import fetch from 'node-fetch';

// Configuration
const CONFIG = {
  // Affiliate Network
  AFFILIATE_API_URL: 'https://mymonetise.co.uk/affiliates/api/Reports/Conversions',
  AFFILIATE_ID: process.env.AFFILIATE_ID || '26142',
  AFFILIATE_API_KEY: process.env.AFFILIATE_API_KEY || 'GTFGZxr0HsDE3AmnlITOoQ',
  
  // TikTok
  TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN || '1695a3cd596550e34c5b8586130b08cfb7326038',
  TIKTOK_EVENT_SET_ID: process.env.TIKTOK_EVENT_SET_ID || '7623547706669023250',
  TIKTOK_API_URL: 'https://business-api.tiktok.com/open_api/v1.3/event/track/',
  
  // Sync settings
  SYNC_INTERVAL_MINUTES: 15,
  ONLY_APPROVED: true
};

/**
 * Get conversions from affiliate network
 */
async function getAffiliateConversions(startDate, endDate) {
  try {
    const params = new URLSearchParams({
      affiliate_id: CONFIG.AFFILIATE_ID,
      api_key: CONFIG.AFFILIATE_API_KEY,
      start_date: startDate,
      end_date: endDate,
      disposition: CONFIG.ONLY_APPROVED ? 'approved' : 'all',
      conversion_type: 'conversions',
      exclude_bot_traffic: 'true',
      row_limit: '1000',
      fields: [
        'conversion_id',
        'conversion_date',
        'offer_id',
        'offer_name',
        'price',
        'disposition',
        'tracking_id',
        'subid_1',
        'subid_2',
        'subid_3',
        'subid_4',
        'subid_5'
      ].join(',')
    });

    const url = `${CONFIG.AFFILIATE_API_URL}?${params.toString()}`;
    
    console.log(`📡 Fetching conversions from affiliate network...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Affiliate API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Got ${data.data?.length || 0} conversions from affiliate network`);
    
    return data.data || [];
  } catch (error) {
    console.error('❌ Error fetching affiliate conversions:', error);
    return [];
  }
}

/**
 * Hash value for TikTok (SHA256)
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
 * Send conversion to TikTok
 */
async function sendConversionToTikTok(conversion) {
  try {
    const {
      conversion_id,
      conversion_date,
      offer_id,
      offer_name,
      price,
      disposition,
      tracking_id,
      subid_1,
      subid_2,
      subid_3,
      subid_4,
      subid_5
    } = conversion;

    // Extract user data from tracking_id or sub IDs if available
    // This depends on how you're passing user data through the affiliate network
    const userEmail = subid_1; // Adjust based on your setup
    const userPhone = subid_2; // Adjust based on your setup
    const userId = tracking_id;

    // Hash user identifiers
    const hashedEmail = userEmail ? await hashValue(userEmail) : null;
    const hashedPhone = userPhone ? await hashValue(userPhone) : null;

    // Build TikTok event payload
    const payload = {
      data: [{
        event: 'Purchase',
        event_id: `conversion_${conversion_id}`,
        timestamp: Math.floor(new Date(conversion_date).getTime() / 1000),
        user: {
          ...(hashedEmail && { email: hashedEmail }),
          ...(hashedPhone && { phone: hashedPhone }),
          ...(userId && { external_id: String(userId) })
        },
        value: parseFloat(price) || 0,
        currency: 'USD',
        properties: {
          offer_id: String(offer_id),
          offer_name: offer_name,
          disposition: disposition,
          conversion_id: String(conversion_id),
          subid_3: subid_3,
          subid_4: subid_4,
          subid_5: subid_5
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
      console.log(`✅ Conversion ${conversion_id} sent to TikTok`);
      return true;
    } else {
      console.error(`❌ TikTok error for conversion ${conversion_id}:`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending conversion ${conversion.conversion_id}:`, error);
    return false;
  }
}

/**
 * Main sync function
 */
async function syncConversions() {
  try {
    // Calculate time range (last 15 minutes + buffer)
    const now = new Date();
    const endDate = new Date(now.getTime() - 2 * 60000); // 2 minutes ago (buffer)
    const startDate = new Date(endDate.getTime() - CONFIG.SYNC_INTERVAL_MINUTES * 60000);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`\n🔄 Starting conversion sync...`);
    console.log(`📅 Date range: ${startDateStr} to ${endDateStr}`);

    // Get conversions from affiliate network
    const conversions = await getAffiliateConversions(startDateStr, endDateStr);

    if (conversions.length === 0) {
      console.log('ℹ️  No new conversions found');
      return { success: true, synced: 0 };
    }

    // Send each conversion to TikTok
    let successCount = 0;
    for (const conversion of conversions) {
      const sent = await sendConversionToTikTok(conversion);
      if (sent) successCount++;
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Sync complete: ${successCount}/${conversions.length} conversions sent to TikTok\n`);
    
    return {
      success: true,
      total: conversions.length,
      synced: successCount,
      failed: conversions.length - successCount
    };
  } catch (error) {
    console.error('❌ Sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * HTTP handler for manual trigger or cron job
 */
export default async function handler(req, res) {
  try {
    // Verify it's a GET request (for cron jobs) or POST with auth token
    if (req.method === 'GET') {
      // Optional: Add auth token verification
      const token = req.query.token;
      if (token !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const result = await syncConversions();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
