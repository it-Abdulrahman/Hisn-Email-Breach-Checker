'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// XposedOrNot free public API — no key required.
const XON_API = 'https://api.xposedornot.com/v1/breach-analytics';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getLang(req) {
  return req.body && req.body.lang === 'en' ? 'en' : 'ar';
}

const MESSAGES = {
  ar: {
    rateLimited: 'محاولات كثيرة جداً، حاول بعد دقيقة.',
    invalidEmail: 'صيغة الإيميل غير صحيحة.',
    upstreamError: 'تعذر الوصول لخدمة الفحص حالياً، حاول لاحقاً.',
  },
  en: {
    rateLimited: 'Too many attempts, try again in a minute.',
    invalidEmail: 'Invalid email format.',
    upstreamError: 'Could not reach the check service right now, try again later.',
  },
};

// --- Privacy: no request logging middleware is installed anywhere in this
// app. The email address is only ever held in memory for the duration of a
// single request and is never written to disk, a database, or a log line.

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Simple in-memory rate limiter, keyed by IP (never by email) ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 8;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: MESSAGES[getLang(req)].rateLimited });
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  next();
}

// Periodic cleanup so the map doesn't grow forever.
setInterval(() => {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of hits) {
    const kept = timestamps.filter((t) => t > windowStart);
    if (kept.length === 0) hits.delete(ip);
    else hits.set(ip, kept);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

const RECOMMENDATION_TEXT = {
  ar: {
    changePassword: {
      title: 'غيّر كلمة المرور فوراً',
      exposed: 'كلمة المرور المرتبطة بهذا الإيميل ظهرت في تسريب سابق — غيّرها الآن في كل موقع تستخدمها فيه.',
      notExposed: 'حتى لو لم تُنشر كلمة المرور، يُفضّل تغييرها كإجراء احترازي في الحسابات المرتبطة بهذا الإيميل.',
    },
    enable2fa: {
      title: 'فعّل التحقق بخطوتين (2FA)',
      detail: 'استخدم تطبيق مصادقة (مثل Google Authenticator أو Authy) بدل الرسائل النصية إن أمكن، على كل حساب مهم (البريد، البنك، السوشيال ميديا).',
    },
    passwordManager: {
      title: 'استخدم مدير كلمات مرور',
      detail: 'ولّد كلمة مرور فريدة وقوية لكل موقع بدل إعادة استخدام نفس الكلمة. أدوات مثل Bitwarden أو 1Password تساعدك بهذا.',
    },
    highPriority: {
      title: 'أولوية عالية',
      detail: 'كلمة المرور المسرّبة كانت محفوظة بشكل ضعيف أو بدون تشفير — احتمالية اختراقها فعلياً أعلى، بادر بتغييرها في كل مكان مشابه.',
    },
    monitorLogins: {
      title: 'راقب نشاط الدخول',
      detail: 'راجع سجل تسجيل الدخول الأخير في حساباتك المهمة (Google، Apple، إلخ) وأنهِ أي جلسات أو أجهزة لا تعرفها.',
    },
    phishing: {
      title: 'انتبه لرسائل التصيّد',
      detail: 'بيانات مسرّبة تُستخدم أحياناً في رسائل احتيال مخصصة باسمك. لا تضغط روابط أو ترد على طلبات كلمات مرور عبر الإيميل.',
    },
  },
  en: {
    changePassword: {
      title: 'Change your password immediately',
      exposed: 'The password linked to this email appeared in a previous breach — change it now everywhere you use it.',
      notExposed: "Even if the password itself wasn't published, it's best to change it as a precaution on accounts linked to this email.",
    },
    enable2fa: {
      title: 'Enable two-factor authentication (2FA)',
      detail: 'Use an authenticator app (like Google Authenticator or Authy) instead of SMS when possible, on every important account (email, banking, social media).',
    },
    passwordManager: {
      title: 'Use a password manager',
      detail: 'Generate a unique, strong password for every site instead of reusing the same one. Tools like Bitwarden or 1Password can help.',
    },
    highPriority: {
      title: 'High priority',
      detail: 'The leaked password was stored weakly or without encryption — the real risk of it being cracked is higher, prioritize changing it everywhere similar.',
    },
    monitorLogins: {
      title: 'Monitor login activity',
      detail: "Review the recent sign-in log on your important accounts (Google, Apple, etc.) and end any sessions or devices you don't recognize.",
    },
    phishing: {
      title: 'Watch out for phishing',
      detail: "Leaked data is sometimes used in scam messages personalized with your name. Don't click links or respond to password requests via email.",
    },
  },
};

function buildRecommendations(lang, { breached, exposedPassword, weakHash }) {
  const T = RECOMMENDATION_TEXT[lang];
  const steps = [];

  if (breached) {
    steps.push({
      title: T.changePassword.title,
      detail: exposedPassword ? T.changePassword.exposed : T.changePassword.notExposed,
    });
  }

  steps.push({ title: T.enable2fa.title, detail: T.enable2fa.detail });
  steps.push({ title: T.passwordManager.title, detail: T.passwordManager.detail });

  if (weakHash) {
    steps.push({ title: T.highPriority.title, detail: T.highPriority.detail });
  }

  steps.push({ title: T.monitorLogins.title, detail: T.monitorLogins.detail });
  steps.push({ title: T.phishing.title, detail: T.phishing.detail });

  return steps;
}

// Account security score out of 10 — 10 means no known exposure.
function computeScore({ breached, breachCount, exposedPassword, weakHash }) {
  if (!breached) return 10;
  let score = 10 - breachCount * 1.3;
  if (exposedPassword) score -= 2;
  if (weakHash) score -= 2.5;
  return Math.max(1, Math.min(9, Math.round(score)));
}

app.post('/api/check', rateLimit, async (req, res) => {
  const lang = getLang(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return res.status(400).json({ error: MESSAGES[lang].invalidEmail });
  }

  try {
    const upstream = await fetch(`${XON_API}?email=${encodeURIComponent(email)}`, {
      headers: { Accept: 'application/json' },
    });

    // XposedOrNot returns a non-200 (e.g. 404) when nothing was found.
    if (upstream.status === 404) {
      return res.json({
        breached: false,
        breaches: [],
        score: 10,
        recommendations: buildRecommendations(lang, { breached: false }),
      });
    }

    if (!upstream.ok) {
      return res.status(502).json({ error: MESSAGES[lang].upstreamError });
    }

    const data = await upstream.json();

    if (data?.Error || !Array.isArray(data?.ExposedBreaches?.breaches_details)) {
      return res.json({
        breached: false,
        breaches: [],
        score: 10,
        recommendations: buildRecommendations(lang, { breached: false }),
      });
    }

    const details = data.ExposedBreaches.breaches_details;
    const breaches = details.map((b) => ({
      name: b.breach,
      year: b.xposed_date,
      exposedData: b.xposed_data,
      passwordRisk: b.password_risk,
      records: b.xposed_records,
    }));

    const breached = breaches.length > 0;
    const exposedPassword = breaches.some((b) => /password/i.test(b.exposedData || ''));
    const weakHash = breaches.some((b) => ['plaintext', 'easytocrack'].includes((b.passwordRisk || '').toLowerCase()));
    const score = computeScore({ breached, breachCount: breaches.length, exposedPassword, weakHash });

    return res.json({
      breached,
      breaches,
      score,
      recommendations: buildRecommendations(lang, { breached, exposedPassword, weakHash }),
    });
  } catch (err) {
    return res.status(502).json({ error: MESSAGES[lang].upstreamError });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
