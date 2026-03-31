/**
 * Simple test version - just returns success
 */

export default async function handler(req, res) {
  try {
    console.log('Request method:', req.method);
    console.log('Query params:', req.query);
    
    // Check token
    const token = req.query.token;
    const expectedToken = process.env.CRON_SECRET;
    
    console.log('Token provided:', token);
    console.log('Expected token:', expectedToken);
    
    if (token !== expectedToken) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing token'
      });
    }

    // Test response
    return res.status(200).json({
      success: true,
      message: 'Test successful - function is working!',
      timestamp: new Date().toISOString(),
      config: {
        tiktok_event_set_id: process.env.TIKTOK_EVENT_SET_ID ? 'SET' : 'NOT SET',
        affiliate_id: process.env.AFFILIATE_ID ? 'SET' : 'NOT SET',
        cron_secret: process.env.CRON_SECRET ? 'SET' : 'NOT SET'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
