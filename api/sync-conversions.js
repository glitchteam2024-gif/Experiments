module.exports = async function handler(req, res) {
  try {
    const token = req.query.token;
    const expectedToken = process.env.CRON_SECRET;
    
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      message: 'Working!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
