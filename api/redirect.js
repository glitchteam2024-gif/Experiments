export default function handler(req, res) {
  // Get the referrer from the request headers
  const referrer = req.headers.referer || req.headers.referrer || '';
  
  // Configuration
  const SKRO_DOMAIN = 'thenexthaul.com';
  const REAL_LINK = 'https://go.thenexthaul.com/click';
  const FAKE_LINK = 'https://go.thenexthaul.com/click';
  
  // Log for debugging (optional - remove in production)
  console.log('[Redirect API] Referrer:', referrer || 'None');
  
  // Check if referrer contains SKRO domain
  const isFromCloaker = referrer.toLowerCase().includes(SKRO_DOMAIN.toLowerCase());
  
  // Decide where to redirect
  let redirectUrl;
  if (isFromCloaker) {
    redirectUrl = REAL_LINK;
    console.log('[Redirect API] ✅ Legitimate traffic from cloaker → Redirecting to real link');
  } else {
    redirectUrl = FAKE_LINK;
    console.log('[Redirect API] 🔄 Direct/suspicious traffic → Redirecting to fake link');
  }
  
  // Set aggressive cache control headers to prevent ANY caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Add timestamp to make each response unique
  res.setHeader('X-Timestamp', Date.now().toString());
  
  // Perform 302 redirect (temporary redirect - not cached by browsers)
  res.status(302);
  res.setHeader('Location', redirectUrl);
  res.end();
}
