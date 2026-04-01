const CONFIG = {
  AFFILIATE_API_URL: 'https://mymonetise.co.uk/affiliates/api/Reports/Conversions',
  AFFILIATE_ID: process.env.AFFILIATE_ID || '26142',
  AFFILIATE_API_KEY: process.env.AFFILIATE_API_KEY || 'GTFGZxr0HsDE3AmnlITOoQ',
  TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN || '1695a3cd596550e34c5b8586130b08cfb7326038',
  TIKTOK_EVENT_SET_ID: process.env.TIKTOK_EVENT_SET_ID || '7623547706669023250',
  TIKTOK_API_URL: 'https://business-api.tiktok.com/open_api/v1.3/event/track/',
  SYNC_INTERVAL_MINUTES: 15,
  ONLY_APPROVED: true
};

async function hashValue(value) {
  if (!value) return null;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash error:', error);
    return null;
  }
}

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
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Affiliate API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching conversions:', error);
    return [];
  }
}

// Added: testEventCode parameter for TikTok test mode
async function sendConversionToTikTok(conversion, testEventCode) {
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

    const userEmail = subid_1;
    const userPhone = subid_2;
    const userId = tracking_id;

    const hashedEmail = userEmail ? await hashValue(userEmail) : null;
    const hashedPhone = userPhone ? await hashValue(userPhone) : null;

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

    // Add test_event_code if provided (for TikTok Events Manager testing)
    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

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
      console.log(`Conversion ${conversion_id} sent to TikTok`);
      return true;
    } else {
      console.error(`TikTok error for conversion ${conversion_id}:`, result);
      return false;
    }
  } catch (error) {
    console.error(`Error sending conversion:`, error);
    return false;
  }
}

// Added: testEventCode parameter passed through
async function syncConversions(testEventCode) {
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() - 2 * 60000);
    const startDate = new Date(endDate.getTime() - CONFIG.SYNC_INTERVAL_MINUTES * 60000);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const conversions = await getAffiliateConversions(startDateStr, endDateStr);

    if (conversions.length === 0) {
      // If testing and no real conversions, send a dummy test event
      if (testEventCode) {
        const testResult = await sendTestEvent(testEventCode);
        return { success: true, synced: 0, total: 0, test_mode: true, test_event_sent: testResult };
      }
      return { success: true, synced: 0, total: 0 };
    }

    let successCount = 0;
    for (const conversion of conversions) {
      const sent = await sendConversionToTikTok(conversion, testEventCode);
      if (sent) successCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      total: conversions.length,
      synced: successCount,
      failed: conversions.length - successCount,
      test_mode: !!testEventCode
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Send a dummy test event when there are no real conversions to test with
async function sendTestEvent(testEventCode) {
  try {
    const payload = {
      event_source: 'web',
      event_source_id: CONFIG.TIKTOK_EVENT_SET_ID,
      test_event_code: testEventCode,
      data: [{
        event: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        user: {
          ip: '75.141.208.17',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
        },
        properties: {
          currency: 'USD',
          value: 1,
          content_name: 'test_conversion',
          content_type: 'product'
        },
        page: {
          url: 'https://www.scrolledrewards.com/RPA1.html'
        }
      }]
    };

    const response = await fetch(CONFIG.TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': CONFIG.TIKTOK_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('Test event result:', result);
    return { sent: true, tiktok_response: result };
  } catch (error) {
    console.error('Test event error:', error);
    return { sent: false, error: error.message };
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const token = req.query.token;
      const expectedToken = process.env.CRON_SECRET || 'tiktok_sync_secret_123';
      
      if (token !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // NEW: Get test_event_code from query or body
    const testEventCode = req.query.test_event_code || (req.body && req.body.test_event_code) || null;

    const result = await syncConversions(testEventCode);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
