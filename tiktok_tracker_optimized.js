// TikTok Pixel Tracker - External tracking file (Dumb Pixel Method)
// This file contains all TikTok pixel code - loads silently from external file
// Pixel ID: D763GVBC77UCP36TC6OG

(function(w, d, t) {
  w.TiktokAnalyticsObject = t;
  var ttq = w[t] = w[t] || [];
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  ttq.setAndDefer = function(t, e) {
    t[e] = function() {
      t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
    }
  };
  for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.instance = function(t) {
    for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
    return e
  }, ttq.load = function(e, n) {
    var r = "https://analytics.tiktok.com/i18n/pixel/events.js", o = n && n.partner;
    ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = r, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {};
    n = document.createElement("script");
    n.type = "text/javascript", n.async = !0, n.src = r + "?sdkid=" + e + "&lib=" + t;
    e = document.getElementsByTagName("script")[0];
    e.parentNode.insertBefore(n, e)
  };
  ttq.load('D763GVBC77UCP36TC6OG');
  ttq.page();
})(window, document, 'ttq');

// Form Fill Tracking (Passive)
document.addEventListener('DOMContentLoaded', function() {
  var forms = document.querySelectorAll('form');
  forms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      ttq.track('Lead', {
        'value': 1,
        'currency': 'USD',
        'content_name': 'form_submission',
        'content_type': 'form'
      });
    });
  });
});

// Capture TikTok Click ID for S2S Postback
window.tiktokClickId = new URLSearchParams(window.location.search).get('ttclid');
if (window.tiktokClickId) {
  fetch('/api/store-click-id', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ttclid: window.tiktokClickId})
  }).catch(function(err) { /* non-critical */ });
}
