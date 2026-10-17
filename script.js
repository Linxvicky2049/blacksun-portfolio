const API_BASE = (window.BLACKSUN_API_URL || '').replace(/\/$/, '');
const state = {
  portfolio: null,
  filter: 'All',
  selectedProject: 0,
  auth: null,
  user: null,
  authSdk: null,
  firebaseConfig: null,
  adminConfigured: false,
  motionInitialized: false
};

const projectMenu = document.getElementById('project-menu');
const projectPanel = document.getElementById('project-panel');
const filterMenu = document.getElementById('project-filters');
const navProjectList = document.getElementById('nav-project-list');
const accountDialog = document.getElementById('account-dialog');
const accountStatus = document.getElementById('account-status');
const accountForm = document.getElementById('account-form');
const adminDashboard = document.getElementById('admin-dashboard');
const adminEditor = document.getElementById('portfolio-editor');
const adminStatus = document.getElementById('admin-status');
const portraitTransform = document.getElementById('portrait-transform');
const portraitFragmentLayer = document.querySelector('.portrait-fragments');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.result = result;
    throw error;
  }
  return result;
}

function selectedProjects() {
  const allProjects = state.portfolio?.projects || [];
  return state.filter === 'All'
    ? allProjects
    : allProjects.filter((project) => project.category === state.filter);
}

function renderNavigationProjects() {
  const projects = state.portfolio?.projects || [];
  navProjectList.innerHTML = projects.map((project) => `
    <a href="#projects" data-project-id="${escapeHtml(project.id)}">${escapeHtml(project.name)}</a>
  `).join('');
  navProjectList.querySelectorAll('[data-project-id]').forEach((link) => {
    link.addEventListener('click', () => selectProjectById(link.dataset.projectId));
  });
}

function renderFilters() {
  const categories = ['All', ...new Set((state.portfolio?.projects || []).map((project) => project.category))];
  filterMenu.innerHTML = categories.map((category) => `
    <button type="button" class="filter-button ${category === state.filter ? 'active' : ''}" aria-pressed="${category === state.filter}" data-filter="${escapeHtml(category)}">
      ${escapeHtml(category)}
    </button>
  `).join('');
  filterMenu.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      state.selectedProject = 0;
      renderProjects();
    });
  });
}

function renderProjects() {
  const projects = selectedProjects();
  if (!projects.length) {
    projectMenu.innerHTML = '<p class="empty-projects">No projects in this category yet.</p>';
    projectPanel.innerHTML = '';
    renderFilters();
    return;
  }

  state.selectedProject = Math.max(0, Math.min(state.selectedProject, projects.length - 1));
  projectMenu.innerHTML = projects.map((project, index) => {
    const selected = index === state.selectedProject;
    const repoUrl = safeUrl(project.repoUrl);
    const initials = String(project.name || 'BS').split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return `
      <button type="button" class="project-tile ${selected ? 'selected' : ''}" data-project-index="${index}" aria-pressed="${selected}" aria-label="Show ${escapeHtml(project.name)}">
        <span class="tile-art" aria-hidden="true" style="--tile-index:${index}"><span>${escapeHtml(initials)}</span></span>
        <span class="tile-category">${escapeHtml(project.category)}</span>
        <span class="tile-title">${escapeHtml(project.name)}</span>
        <span class="status-tag status-${escapeHtml(String(project.status).toLowerCase().replace(/[^a-z]+/g, '-'))}">${escapeHtml(project.status)}</span>
        ${repoUrl ? '<span class="repo-hint">GitHub repo ↗</span>' : ''}
      </button>
    `;
  }).join('');

  projectMenu.querySelectorAll('[data-project-index]').forEach((tile) => {
    tile.addEventListener('click', () => {
      state.selectedProject = Number(tile.dataset.projectIndex);
      renderProjects();
      const nextTile = projectMenu.querySelector(`[data-project-index="${state.selectedProject}"]`);
      nextTile?.focus();
      nextTile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  renderProjectDetails(projects[state.selectedProject]);
  renderFilters();
}

function renderProjectDetails(project) {
  const liveUrl = safeUrl(project.href);
  const previewUrl = safeUrl(project.previewUrl || (project.status === 'Live' ? project.href : ''));
  const repoUrl = safeUrl(project.repoUrl);
  const tech = Array.isArray(project.tech) ? project.tech : [];
  projectPanel.innerHTML = `
    <div class="project-detail-copy">
      <div class="project-header">
        <div>
          <p class="eyebrow">${escapeHtml(project.category)}</p>
          <h3>${escapeHtml(project.name)}</h3>
        </div>
        <span class="status-tag status-${escapeHtml(String(project.status).toLowerCase().replace(/[^a-z]+/g, '-'))}">${escapeHtml(project.status)}</span>
      </div>
      <p>${escapeHtml(project.description)}</p>
      <div class="project-tags">${tech.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      <div class="project-card-actions">
        ${liveUrl ? `<a class="primary" href="${liveUrl}" target="_blank" rel="noopener noreferrer">${project.status === 'Live' ? 'Open live project ↗' : 'Open project link ↗'}</a>` : ''}
        ${repoUrl ? `<a href="${repoUrl}" target="_blank" rel="noopener noreferrer">View repository ↗</a>` : ''}
      </div>
      <p class="project-source">Source: ${escapeHtml(project.source || 'Public GitHub repository')}</p>
    </div>
    ${previewUrl ? `
      <div class="project-preview">
        <div class="preview-heading"><span>${project.status === 'Live' ? 'LIVE PREVIEW' : 'PROJECT PREVIEW'}</span><a href="${previewUrl}" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a></div>
        <iframe src="${previewUrl}" title="${escapeHtml(project.name)} project preview" loading="lazy" sandbox="allow-forms allow-scripts allow-same-origin" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
    ` : '<div class="preview-placeholder"><span>PROJECT PREVIEW</span><p>A live visual preview is not available for this project. Use the repository link to explore its source.</p></div>'}
  `;
}

function selectProjectById(id) {
  const allProjects = state.portfolio?.projects || [];
  const project = allProjects.find((entry) => entry.id === id);
  if (!project) return;
  state.filter = 'All';
  state.selectedProject = allProjects.indexOf(project);
  renderProjects();
  document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
  const tile = projectMenu.querySelector(`[data-project-index="${state.selectedProject}"]`);
  tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function renderSkills(skills = {}) {
  const sections = [
    ['frontend', 'Frontend'],
    ['backend', 'Backend'],
    ['data', 'Databases and platforms'],
    ['ai', 'AI and computer vision'],
    ['hardware', 'Hardware and IoT'],
    ['tools', 'Tools']
  ];
  document.getElementById('skill-clusters').innerHTML = sections.map(([key, title]) => `
    <article class="skill-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="tag-row">${(skills[key] || []).map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}</div>
    </article>
  `).join('');
}

function renderAiLab(projects = []) {
  document.getElementById('ai-projects').innerHTML = projects.map((project) => {
    const liveUrl = safeUrl(project.href);
    const repoUrl = safeUrl(project.repoUrl);
    return `
      <article class="ai-project">
        <p class="eyebrow">${escapeHtml(project.kind || 'Project')}</p>
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <div class="ai-tag-row">${(project.technology || []).map((tech) => `<span class="ai-tag">${escapeHtml(tech)}</span>`).join('')}</div>
        <span class="ai-status">${escapeHtml(project.status)}</span>
        <div class="project-card-actions">
          ${liveUrl ? `<a href="${liveUrl}" target="_blank" rel="noopener noreferrer">Live project ↗</a>` : ''}
          ${repoUrl ? `<a href="${repoUrl}" target="_blank" rel="noopener noreferrer">Repository ↗</a>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderSupport(support) {
  document.getElementById('account-number').textContent = support.accountNumber || '';
  const holder = document.getElementById('account-holder');
  const holderLabel = document.getElementById('account-holder-label');
  holder.textContent = support.accountHolder || '';
  holder.hidden = !support.accountHolder;
  holderLabel.hidden = !support.accountHolder;
  const card = document.querySelector('.support-card > div:first-child');
  card.querySelector('p:last-child').textContent = support.note || 'Voluntary support for independent project work.';
}

function renderPortfolio(portfolio) {
  state.portfolio = portfolio;
  renderProjects();
  renderNavigationProjects();
  renderSkills(portfolio.skills);
  renderAiLab(portfolio.aiProjects);
  renderSupport(portfolio.support || {});
  document.getElementById('hero-lead').textContent = portfolio.headline || '';
  document.getElementById('profile-name').textContent = (portfolio.name || '').split(/\s+/)[1] || 'BLACKSUN';
  document.getElementById('professional-title').textContent = portfolio.title || '';
  document.getElementById('about-title').textContent = portfolio.about?.title || '';
  document.getElementById('about-paragraph-one').textContent = portfolio.about?.paragraphs?.[0] || '';
  document.getElementById('about-paragraph-two').textContent = portfolio.about?.paragraphs?.[1] || '';
  document.getElementById('contact-intro').textContent = portfolio.contact?.intro || '';
  document.getElementById('contact-location').textContent = portfolio.contact?.location || portfolio.location || '';
  document.querySelectorAll('[data-social]').forEach((link) => {
    const url = portfolio.socials?.[link.dataset.social];
    if (url) {
      link.href = url;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
  });
  const directEmail = document.getElementById('direct-email');
  if (portfolio.email) {
    directEmail.textContent = portfolio.email;
    directEmail.href = `mailto:${portfolio.email}`;
  }
  const pageDescription = document.querySelector('meta[name="description"]');
  if (pageDescription) pageDescription.content = portfolio.headline || pageDescription.content;
  const socialDescription = document.querySelector('meta[property="og:description"]');
  if (socialDescription) socialDescription.content = portfolio.headline || socialDescription.content;
  if (portfolio.name) document.title = `BLACKSUN // DIGITAL UNIVERSE | ${portfolio.name}`;
}

async function loadPortfolio() {
  try {
    const localResponse = await fetch('./portfolio-data.json');
    if (!localResponse.ok) throw new Error(`Portfolio data returned ${localResponse.status}.`);
    const localPortfolio = await localResponse.json();
    renderPortfolio(localPortfolio);
  } catch (error) {
    console.error('Could not load the bundled portfolio catalog:', error);
    projectPanel.textContent = 'Portfolio projects could not be loaded. Please try again later.';
  }

  try {
    const livePortfolio = await request('/api/portfolio');
    renderPortfolio(livePortfolio);
  } catch (error) {
    if (error.status !== 404) console.warn('Live portfolio updates are unavailable; using bundled project data.', error);
  }
}

function setAccountStatus(message, error = false) {
  accountStatus.textContent = message;
  accountStatus.classList.toggle('error', error);
  const signedInStatus = document.getElementById('signed-in-status');
  signedInStatus.textContent = message;
  signedInStatus.classList.toggle('error', error);
}

function openAccountDialog() {
  accountDialog.hidden = false;
  accountDialog.querySelector('input')?.focus();
  document.body.classList.add('dialog-open');
}

function closeAccountDialog() {
  accountDialog.hidden = true;
  document.body.classList.remove('dialog-open');
}

function toggleSupport() {
  const section = document.getElementById('support');
  section.hidden = !section.hidden;
  if (!section.hidden) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function bindNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  const projectToggle = document.querySelector('.nav-project-toggle');
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
  projectToggle.addEventListener('click', () => {
    const expanded = projectToggle.getAttribute('aria-expanded') !== 'true';
    projectToggle.setAttribute('aria-expanded', String(expanded));
    navProjectList.classList.toggle('open', expanded);
  });
  document.getElementById('support-open').addEventListener('click', () => {
    toggleSupport();
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
  document.getElementById('account-open').addEventListener('click', openAccountDialog);
  document.getElementById('account-close').addEventListener('click', closeAccountDialog);
  accountDialog.addEventListener('click', (event) => {
    if (event.target === accountDialog) closeAccountDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAccountDialog();
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindCarousel() {
  const scrollByOneCard = (direction) => {
    const tile = projectMenu.querySelector('.project-tile');
    const distance = tile ? tile.getBoundingClientRect().width + 14 : 260;
    projectMenu.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };
  document.querySelector('.project-nav.prev').addEventListener('click', () => scrollByOneCard(-1));
  document.querySelector('.project-nav.next').addEventListener('click', () => scrollByOneCard(1));
  projectMenu.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByOneCard(-1);
      state.selectedProject = Math.max(0, state.selectedProject - 1);
      renderProjects();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByOneCard(1);
      state.selectedProject = Math.min(selectedProjects().length - 1, state.selectedProject + 1);
      renderProjects();
    }
  });
}

function bindContact() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const submitButton = form.querySelector('[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    status.textContent = 'Sending your message…';
    status.classList.remove('error');
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const result = await request('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.classList.add('error');
      status.textContent = `${error.message} Email Victor directly at ${state.portfolio?.email || 'victor4all2015@gmail.com'}.`;
    } finally {
      submitButton.disabled = false;
    }
  });
}

function bindSupport() {
  document.querySelector('.copy-button').addEventListener('click', async () => {
    const number = document.getElementById('account-number').textContent;
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(number);
      status.textContent = 'Account number copied';
    } catch (error) {
      status.textContent = 'Copy failed. Please copy the number manually.';
    }
  });
}

function bindToolLogoFallbacks() {
  document.querySelectorAll('.tool-logo-card img').forEach((image) => {
    image.addEventListener('error', () => {
      const mark = document.createElement('span');
      mark.className = 'tool-mark-fallback';
      mark.textContent = image.alt || image.nextElementSibling?.textContent?.slice(0, 2) || '•';
      image.replaceWith(mark);
    }, { once: true });
  });
}

function createPortraitFragments() {
  const columns = 10;
  const rows = 12;
  const fragments = document.createDocumentFragment();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const fragment = document.createElement('span');
      const dx = (column - (columns - 1) / 2) * 13 + (Math.random() - 0.5) * 55;
      const dy = (row - (rows - 1) / 2) * 13 + (Math.random() - 0.5) * 55;
      fragment.className = 'portrait-fragment';
      fragment.style.setProperty('--fragment-left', `${column / columns * 100}%`);
      fragment.style.setProperty('--fragment-top', `${row / rows * 100}%`);
      fragment.style.setProperty('--fragment-x', `${column / (columns - 1) * 100}%`);
      fragment.style.setProperty('--fragment-y', `${row / (rows - 1) * 100}%`);
      fragment.style.setProperty('--fragment-delay', `${Math.random() * 220}ms`);
      fragment.style.setProperty('--fragment-dx', `${dx.toFixed(1)}px`);
      fragment.style.setProperty('--fragment-dy', `${dy.toFixed(1)}px`);
      fragment.style.setProperty('--fragment-dz', `${100 + Math.random() * 420}px`);
      fragment.style.setProperty('--fragment-rx', `${(Math.random() - 0.5) * 220}deg`);
      fragment.style.setProperty('--fragment-ry', `${(Math.random() - 0.5) * 260}deg`);
      fragment.style.setProperty('--fragment-rz', `${(Math.random() - 0.5) * 180}deg`);
      fragments.append(fragment);
    }
  }

  portraitFragmentLayer.replaceChildren(fragments);
}

function bindPortraitTransform() {
  createPortraitFragments();
  portraitTransform.addEventListener('click', () => {
    const showAvatar = portraitTransform.getAttribute('aria-pressed') !== 'true';
    portraitTransform.setAttribute('aria-pressed', String(showAvatar));
    const transitionImage = showAvatar ? 'assets/victor.png' : 'assets/victor-avatar.png';
    portraitFragmentLayer.querySelectorAll('.portrait-fragment').forEach((fragment) => {
      fragment.style.backgroundImage = `url("${transitionImage}")`;
    });
    document.querySelector('.portrait-source').setAttribute('aria-hidden', String(showAvatar));
    document.querySelector('.portrait-avatar').setAttribute('aria-hidden', String(!showAvatar));
    portraitTransform.classList.toggle('is-avatar', showAvatar);
    portraitTransform.classList.remove('is-transitioning');
    void portraitTransform.offsetWidth;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    portraitTransform.classList.add('is-transitioning');
  });

  portraitFragmentLayer.addEventListener('animationend', (event) => {
    if (!event.target.matches('.portrait-fragment')) return;
    const animationsRunning = [...portraitFragmentLayer.querySelectorAll('.portrait-fragment')]
      .some((fragment) => fragment.getAnimations().some((animation) => animation.playState === 'running'));
    if (!animationsRunning) portraitTransform.classList.remove('is-transitioning');
  });
}

async function idToken() {
  if (!state.user) throw new Error('Sign in before continuing.');
  return state.user.getIdToken();
}

async function authorizedRequest(path, options = {}) {
  const token = await idToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  return request(path, { ...options, headers });
}

function updateAdminVisibility(user) {
  const allowed = Boolean(user && user.emailVerified && state.adminConfigured && user.email?.toLowerCase() === state.firebaseConfig.adminEmail?.toLowerCase());
  adminDashboard.hidden = !allowed;
  document.getElementById('admin-open').hidden = !allowed;
  if (allowed) {
    loadAdminPortfolio().catch((error) => {
      adminStatus.textContent = error.message;
      adminStatus.classList.add('error');
    });
  } else {
    adminEditor.value = '';
  }
}

async function loadAdminPortfolio() {
  const portfolio = await authorizedRequest('/api/admin/portfolio');
  adminEditor.value = JSON.stringify(portfolio, null, 2);
  renderAdminProjectOptions();
  adminStatus.textContent = 'Loaded the current saved portfolio.';
  adminStatus.classList.remove('error');
}

function readAdminDraft() {
  const content = JSON.parse(adminEditor.value);
  if (!content || !Array.isArray(content.projects)) {
    throw new Error('Portfolio data must include a projects array.');
  }
  return content;
}

function renderAdminProjectOptions(selectedId = '') {
  const select = document.getElementById('admin-project-select');
  const content = readAdminDraft();
  select.replaceChildren(new Option('Select a project…', ''));
  content.projects.forEach((project) => {
    select.add(new Option(project.name, project.id));
  });
  select.value = selectedId;
}

function fillAdminProjectForm(project) {
  document.getElementById('admin-project-name').value = project?.name || '';
  document.getElementById('admin-project-category').value = project?.category || '';
  document.getElementById('admin-project-status').value = project?.status || 'In Development';
  document.getElementById('admin-project-description').value = project?.description || '';
  document.getElementById('admin-project-repo').value = project?.repoUrl || '';
  document.getElementById('admin-project-live').value = project?.href || '';
  document.getElementById('admin-project-preview').value = project?.previewUrl || '';
  document.getElementById('admin-project-tech').value = (project?.tech || []).join(', ');
}

function adminProjectFormError(error) {
  adminStatus.textContent = error.message;
  adminStatus.classList.add('error');
}

async function subscribeToUpdates(enabled) {
  return authorizedRequest('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updatesEnabled: enabled })
  });
}

function updateAccountView(user) {
  const signedIn = Boolean(user);
  document.getElementById('account-form-wrap').hidden = signedIn;
  document.getElementById('account-signed-in').hidden = !signedIn;
  if (user) {
    document.getElementById('account-identity').textContent = user.emailVerified
      ? `Signed in as ${user.email}`
      : `Signed in as ${user.email}. Verify your email before subscribing to updates or using admin tools.`;
    document.getElementById('updates-toggle').hidden = !user.emailVerified;
  }
  updateAdminVisibility(user);
}

async function initAuth() {
  try {
    const config = await request('/api/auth-config');
    state.firebaseConfig = { ...config.firebase, adminEmail: config.adminEmail || '' };
    state.adminConfigured = config.adminConfigured;
    if (!config.firebase.apiKey || !config.firebase.authDomain || !config.firebase.projectId || !config.firebase.appId) {
      setAccountStatus('Account sign-in is not configured on this server. The portfolio itself remains available.');
      return;
    }

    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js')
    ]);
    const firebaseApp = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config.firebase);
    state.auth = authSdk.getAuth(firebaseApp);
    state.authSdk = authSdk;

    authSdk.onAuthStateChanged(state.auth, async (user) => {
      state.user = user;
      updateAccountView(user);
      if (user?.emailVerified) {
        try {
          const prefs = await authorizedRequest('/api/subscriptions');
          accountForm.elements.updates.checked = Boolean(prefs.updatesEnabled);
          document.getElementById('updates-toggle').textContent = prefs.updatesEnabled
            ? 'Turn email updates off'
            : 'Turn email updates on';
        } catch (error) {
          console.warn('Could not load email update preferences:', error);
        }
      }
    });
  } catch (error) {
    console.error('Authentication setup is unavailable:', error);
    setAccountStatus('Sign-in services are temporarily unavailable. Please use the portfolio without an account for now.', true);
  }
}

function bindAuth() {
  accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const intent = event.submitter?.value || 'login';
    const formData = new FormData(accountForm);
    const email = String(formData.get('email')).trim();
    const password = String(formData.get('password'));
    setAccountStatus('Working…');
    try {
      const sdk = state.authSdk;
      if (!sdk || !state.auth) throw new Error('Sign-in is not configured.');
      let credential;
      if (intent === 'register') {
        credential = await sdk.createUserWithEmailAndPassword(state.auth, email, password);
        await sdk.sendEmailVerification(credential.user);
        setAccountStatus('Account created. Check your inbox for the email verification link, then sign in again.');
        return;
      }

      credential = await sdk.signInWithEmailAndPassword(state.auth, email, password);
      if (!credential.user.emailVerified) {
        await sdk.sendEmailVerification(credential.user);
        setAccountStatus('Please verify your email. We sent a verification link to your inbox.');
        return;
      }
      await subscribeToUpdates(formData.get('updates') === 'on');
      setAccountStatus('Signed in. Your email update preference has been saved.');
    } catch (error) {
      setAccountStatus(error.message || 'Could not complete sign-in.', true);
    }
  });

  document.getElementById('google-login').addEventListener('click', async () => {
    try {
      if (!state.auth || !state.authSdk) throw new Error('Sign-in is not configured.');
      const provider = new state.authSdk.GoogleAuthProvider();
      const credential = await state.authSdk.signInWithPopup(state.auth, provider);
      if (credential.user.emailVerified) {
        const enabled = accountForm.elements.updates.checked;
        await subscribeToUpdates(enabled);
      }
    } catch (error) {
      setAccountStatus(error.message || 'Google sign-in failed.', true);
    }
  });

  document.getElementById('account-logout').addEventListener('click', async () => {
    if (state.auth) await state.authSdk.signOut(state.auth);
  });

  document.getElementById('admin-open').addEventListener('click', () => {
    closeAccountDialog();
    adminDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('updates-toggle').addEventListener('click', async () => {
    const enabled = accountForm.elements.updates.checked;
    try {
      await subscribeToUpdates(!enabled);
      accountForm.elements.updates.checked = !enabled;
      document.getElementById('updates-toggle').textContent = enabled
        ? 'Turn email updates on'
        : 'Turn email updates off';
      setAccountStatus(`Email updates ${enabled ? 'turned off' : 'turned on'}.`);
    } catch (error) {
      setAccountStatus(error.message, true);
    }
  });

  document.getElementById('admin-refresh').addEventListener('click', () => {
    loadAdminPortfolio().catch((error) => {
      adminStatus.textContent = error.message;
      adminStatus.classList.add('error');
    });
  });

  const adminProjectSelect = document.getElementById('admin-project-select');
  const adminProjectForm = document.getElementById('admin-project-form');
  adminProjectSelect.addEventListener('change', () => {
    try {
      const project = readAdminDraft().projects.find((item) => item.id === adminProjectSelect.value);
      fillAdminProjectForm(project);
    } catch (error) {
      adminProjectFormError(error);
    }
  });

  document.getElementById('admin-project-new').addEventListener('click', () => {
    adminProjectSelect.value = '';
    fillAdminProjectForm(null);
    document.getElementById('admin-project-name').focus();
  });

  adminProjectForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const content = readAdminDraft();
      const selectedId = adminProjectSelect.value;
      const name = document.getElementById('admin-project-name').value.trim();
      const id = selectedId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!id) throw new Error('Enter a project name to create its project ID.');
      const repoUrl = document.getElementById('admin-project-repo').value.trim();
      const liveUrl = document.getElementById('admin-project-live').value.trim();
      if (!repoUrl && !liveUrl) throw new Error('Add a GitHub repository URL or a live project URL.');

      const project = {
        ...(content.projects.find((item) => item.id === id) || {}),
        id,
        name,
        category: document.getElementById('admin-project-category').value.trim(),
        status: document.getElementById('admin-project-status').value,
        description: document.getElementById('admin-project-description').value.trim(),
        tech: document.getElementById('admin-project-tech').value.split(',').map((item) => item.trim()).filter(Boolean),
        repoUrl,
        href: liveUrl,
        previewUrl: document.getElementById('admin-project-preview').value.trim()
      };
      const existingIndex = content.projects.findIndex((item) => item.id === id);
      if (existingIndex === -1) content.projects.push(project);
      else content.projects[existingIndex] = project;

      adminEditor.value = JSON.stringify(content, null, 2);
      renderAdminProjectOptions(id);
      adminStatus.textContent = 'Project draft updated. Save website updates to publish it.';
      adminStatus.classList.remove('error');
    } catch (error) {
      adminProjectFormError(error);
    }
  });

  document.getElementById('admin-project-delete').addEventListener('click', () => {
    try {
      const content = readAdminDraft();
      const selectedId = adminProjectSelect.value;
      if (!selectedId) throw new Error('Select a project before removing it.');
      const project = content.projects.find((item) => item.id === selectedId);
      if (!window.confirm(`Remove “${project?.name || selectedId}” from this draft?`)) return;
      content.projects = content.projects.filter((item) => item.id !== selectedId);
      adminEditor.value = JSON.stringify(content, null, 2);
      renderAdminProjectOptions();
      fillAdminProjectForm(null);
      adminStatus.textContent = 'Project removed from the draft. Save website updates to publish the change.';
      adminStatus.classList.remove('error');
    } catch (error) {
      adminProjectFormError(error);
    }
  });

  document.getElementById('admin-save').addEventListener('click', async () => {
    adminStatus.classList.remove('error');
    adminStatus.textContent = 'Saving changes…';
    try {
      const content = JSON.parse(adminEditor.value);
      const result = await authorizedRequest('/api/admin/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      renderPortfolio(content);
      const sent = result.notifications?.sent || 0;
      const failed = result.notifications?.failed || 0;
      if (!result.notifications?.configured) {
        adminStatus.textContent = `${result.message} Update emails were not sent because email or Firebase is not configured.`;
      } else if (failed) {
        adminStatus.textContent = `${result.message} ${sent} update email${sent === 1 ? '' : 's'} sent; ${failed} failed. Check the server logs.`;
      } else {
        adminStatus.textContent = `${result.message} ${sent} update email${sent === 1 ? '' : 's'} sent.`;
      }
    } catch (error) {
      adminStatus.textContent = error instanceof SyntaxError ? 'The editor contains invalid JSON. Fix it before saving.' : error.message;
      adminStatus.classList.add('error');
    }
  });
}

async function init() {
  bindNavigation();
  bindCarousel();
  bindContact();
  bindSupport();
  bindToolLogoFallbacks();
  bindPortraitTransform();
  bindAuth();
  setupMotion();
  await loadPortfolio();
  await initAuth();
  setupBackgroundStars();
}

function setupMotion() {
  if (state.motionInitialized) return;
  if (document.visibilityState === 'hidden') {
    const resumeWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', resumeWhenVisible);
      setupMotion();
    };
    document.addEventListener('visibilitychange', resumeWhenVisible);
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;
  state.motionInitialized = true;
  const visual = document.querySelector('.hero-visual');

  const revealTargets = document.querySelectorAll(
    '.hero-copy, .hero-visual, .section-head, .about-visual, .about-copy, .ai-panel, .contact-form'
  );

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -36px 0px' });

    revealTargets.forEach((element) => {
      element.classList.add('reveal-on-scroll');
      observer.observe(element);
    });
    document.body.classList.add('motion-enabled');
  }

  if (!visual || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  visual.addEventListener('pointermove', (event) => {
    const bounds = visual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    visual.style.setProperty('--pointer-tilt-x', `${(y * -7).toFixed(2)}deg`);
    visual.style.setProperty('--pointer-tilt-y', `${(x * 9).toFixed(2)}deg`);
  }, { passive: true });

  visual.addEventListener('pointerleave', () => {
    visual.style.setProperty('--pointer-tilt-x', '0deg');
    visual.style.setProperty('--pointer-tilt-y', '0deg');
  }, { passive: true });
}

function setupBackgroundStars() {
  const canvas = document.getElementById('space');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stars = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars.length = 0;
    const count = Math.min(140, Math.max(50, Math.floor(window.innerWidth / 11)));
    for (let index = 0; index < count; index += 1) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.6 + 0.15,
        drift: Math.random() * 0.3 + 0.08
      });
    }
    if (reducedMotion) draw();
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach((star) => {
      if (!reducedMotion) {
        star.x += star.drift;
        if (star.x > canvas.width) star.x = 0;
      }
      context.beginPath();
      context.fillStyle = `rgba(220,238,255,${star.alpha})`;
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });
    if (!reducedMotion) requestAnimationFrame(draw);
  }

  resize();
  if (!reducedMotion) draw();
  window.addEventListener('resize', resize, { passive: true });
}

init();
