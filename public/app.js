(() => {
  const form = document.getElementById('check-form');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submit-btn');
  const resultEl = document.getElementById('result');
  const langToggleBtn = document.getElementById('lang-toggle');

  const translations = {
    ar: {
      brand: 'حصن',
      title: 'حصن | فحص تسرب الإيميل',
      tagline: 'هل تسرّب إيميلك؟',
      sub: 'تحقق إذا كان بريدك الإلكتروني ظهر في اختراقات بيانات سابقة، واحصل على خطوات فورية لتأمين حساباتك.',
      emailLabel: 'بريدك الإلكتروني',
      submit: 'افحص الآن',
      submitting: 'جاري الفحص...',
      privacy: '🔒 لا نقوم بتخزين بريدك الإلكتروني على خوادمنا — يُستخدم فقط لحظة الفحص ثم يُهمل.',
      footer: 'بيانات الفحص من خدمة',
      footerService: 'المجانية.',
      scoreLabel: 'درجة أمان الحساب',
      scoreOutOf: '/ 10',
      errorGeneric: 'حدث خطأ غير متوقع.',
      errorConnection: 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت.',
      breachedTitle: '⚠️ تم العثور على تسريب',
      breachedDesc: (n) => `هذا الإيميل ظهر في ${n} اختراق${n > 1 ? 'ات' : ''} بيانات معروف${n > 1 ? 'ة' : ''}. راجع الخطوات أدناه فوراً.`,
      safeTitle: '✅ لا يوجد تسريب معروف',
      safeDesc: 'لم نجد هذا الإيميل في قواعد بيانات الاختراقات المعروفة لدينا. هذا لا يعني أمانك المطلق — استمر بالممارسات الآمنة أدناه.',
      scoreLevels: { strong: 'قوي', medium: 'متوسط', weak: 'ضعيف' },
      toggleLabel: 'Switch to English',
    },
    en: {
      brand: 'Hisn',
      title: 'Hisn | Email Breach Checker',
      tagline: 'Has your email been breached?',
      sub: 'Check if your email has appeared in known data breaches, and get instant steps to secure your accounts.',
      emailLabel: 'Your email',
      submit: 'Check now',
      submitting: 'Checking...',
      privacy: '🔒 We never store your email on our servers — it is used only for this check, then discarded.',
      footer: 'Breach data from',
      footerService: '(free service).',
      scoreLabel: 'Account Security Score',
      scoreOutOf: '/ 10',
      errorGeneric: 'An unexpected error occurred.',
      errorConnection: 'Could not reach the server, check your internet connection.',
      breachedTitle: '⚠️ Breach found',
      breachedDesc: (n) => `This email appeared in ${n} known data breach${n > 1 ? 'es' : ''}. Review the steps below immediately.`,
      safeTitle: '✅ No known breach',
      safeDesc: 'We did not find this email in our known breach databases. This does not guarantee absolute safety — keep following safe practices below.',
      scoreLevels: { strong: 'Strong', medium: 'Medium', weak: 'Weak' },
      toggleLabel: 'التبديل إلى العربية',
    },
  };

  let lang = localStorage.getItem('Hisn-lang') || 'ar';

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function applyLang(newLang) {
    lang = newLang;
    localStorage.setItem('Hisn-lang', lang);
    const t = translations[lang];

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t.title;

    document.getElementById('brand-title').textContent = t.brand;
    document.getElementById('tagline').textContent = t.tagline;
    document.getElementById('sub-desc').textContent = t.sub;
    document.getElementById('email-label').textContent = t.emailLabel;
    emailInput.placeholder = 'example@email.com';
    submitBtn.textContent = t.submit;
    document.getElementById('privacy-note').textContent = t.privacy;
    const footerTextEl = document.getElementById('footer-text');
    if (footerTextEl) {
      footerTextEl.innerHTML =
        `${escapeHtml(t.footer)} <a href="https://xposedornot.com" target="_blank" rel="noopener noreferrer">XposedOrNot</a> ${escapeHtml(t.footerService)}`;
    }

    langToggleBtn.textContent = lang === 'ar' ? 'EN' : 'AR';
    langToggleBtn.setAttribute('aria-label', t.toggleLabel);

    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }

  langToggleBtn.addEventListener('click', () => {
    applyLang(lang === 'ar' ? 'en' : 'ar');
  });

  function scoreTier(score) {
    if (score >= 8) return 'score-strong';
    if (score >= 5) return 'score-medium';
    return 'score-weak';
  }

  function renderScoreGauge(score) {
    const t = translations[lang];
    const tier = scoreTier(score);
    const tierLabel = t.scoreLevels[tier.replace('score-', '')];
    const circumference = 2 * Math.PI * 54;
    const offset = circumference * (1 - score / 10);

    return `
      <div class="score-gauge">
        <svg viewBox="0 0 120 120">
          <circle class="gauge-bg" cx="60" cy="60" r="54"></circle>
          <circle class="gauge-fg ${tier}" cx="60" cy="60" r="54"
            style="stroke-dasharray:${circumference}px; stroke-dashoffset:${circumference}px;"
            data-offset="${offset}"></circle>
        </svg>
        <div class="gauge-center">
          <span class="gauge-score">${score}</span>
          <span class="gauge-outof">${escapeHtml(t.scoreOutOf)}</span>
        </div>
      </div>
      <p class="gauge-label ${tier}">${escapeHtml(t.scoreLabel)}: ${escapeHtml(tierLabel)}</p>
    `;
  }

  function animateGauge() {
    const fg = resultEl.querySelector('.gauge-fg');
    if (!fg) return;
    const target = fg.dataset.offset;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fg.style.strokeDashoffset = `${target}px`;
      });
    });
  }

  function renderError(message) {
    resultEl.hidden = false;
    resultEl.innerHTML = `<p class="error-note">${escapeHtml(message)}</p>`;
  }

  function renderResult(data) {
    const { breached, breaches, recommendations, score } = data;
    const t = translations[lang];

    const gaugeHtml = typeof score === 'number' ? renderScoreGauge(score) : '';

    const statusHtml = breached
      ? `<div class="status-card breached">
           ${gaugeHtml}
           <p class="status-title">${t.breachedTitle}</p>
           <p class="status-desc">${escapeHtml(t.breachedDesc(breaches.length))}</p>
           <div class="breach-list">
             ${breaches.map((b) => `<span class="breach-pill">${escapeHtml(b.name)}${b.year ? ` · ${escapeHtml(b.year)}` : ''}</span>`).join('')}
           </div>
         </div>`
      : `<div class="status-card safe">
           ${gaugeHtml}
           <p class="status-title">${t.safeTitle}</p>
           <p class="status-desc">${escapeHtml(t.safeDesc)}</p>
         </div>`;

    const stepsHtml = `
      <div class="steps">
        ${recommendations.map((r, i) => `
          <div class="step">
            <div class="step-num">${i + 1}</div>
            <div class="step-body">
              <h3>${escapeHtml(r.title)}</h3>
              <p>${escapeHtml(r.detail)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    resultEl.hidden = false;
    resultEl.innerHTML = statusHtml + stepsHtml;
    animateGauge();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    const t = translations[lang];
    submitBtn.disabled = true;
    submitBtn.textContent = t.submitting;
    resultEl.hidden = true;
    resultEl.innerHTML = '';

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });
      const data = await res.json();

      if (!res.ok) {
        renderError(data.error || t.errorGeneric);
      } else {
        renderResult(data);
      }
    } catch (err) {
      renderError(t.errorConnection);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t.submit;
      // لا نخزّن الإيميل في أي مكان — نمسحه من الحقل بعد الفحص.
      emailInput.value = '';
    }
  });

  applyLang(lang);
})();
