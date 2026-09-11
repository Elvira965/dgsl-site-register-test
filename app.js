// ============================================================
// DGSL SITE REGISTER
// Supabase Database + Storage + Live Updates
// Photos + Signatures + PDF + Backup
// ============================================================

const SUPABASE_URL =
  'https://mgxbsxqgjxpdvdjsixqi.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_XWLtSyttiEMQA86unKN37A_ZC9OY19j';

const PHOTO_BUCKET =
  'handover-photos-test';

const LOGO_FILE =
  'dgsl-logo.png';

let supabaseClient = null;
let records = [];
let editing = null;
let filter = 'All';

const SITE_VERSION = '1.2.4';
const NOTIFICATIONS_TABLE = 'site_notifications_test';
const NOTIFICATIONS_SEEN_KEY = 'dgsl_site_register_test_notifications_seen_v1';

// Single source of truth for the website version.
function applySiteVersion() {
  document.querySelectorAll('[data-site-version]').forEach(element => {
    element.textContent = SITE_VERSION;
  });
}

applySiteVersion();
document.addEventListener('DOMContentLoaded', applySiteVersion);

const $ = s => document.querySelector(s);

const rows = $('#rows');
const dlg = $('#formDialog');
const form = $('#handoverForm');

let currentUser = null;
let authDialog = null;
let notificationPollTimer = null;

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ============================================================
// AUTHENTICATION UI
// ============================================================

function ensureAuthUi() {
  const headerActions = document.getElementById('headerActions');
  if (!headerActions) return;

  let button = document.getElementById('dgslAuthButton');
  if (!button) {
    button = document.createElement('button');
    button.id = 'dgslAuthButton';
    button.type = 'button';
    button.textContent = 'Login';
    button.className = 'auth-button';
    button.onclick = async () => {
      if (currentUser) {
        openSettingsDialog();
      } else {
        showAuthDialog();
      }
    };
    headerActions.appendChild(button);
  }

  const notificationsButton = document.getElementById('notificationsButton');
  const settingsButton = document.getElementById('settingsButton');

  if (notificationsButton) {
    notificationsButton.onclick = () => openNotificationsDialog();
  }
  if (settingsButton) {
    settingsButton.onclick = () => openSettingsDialog();
  }

  updateAuthUi();
}

function updateAuthUi() {
  const button = document.getElementById('dgslAuthButton');
  const newButton = document.getElementById('newZone');
  const notificationsButton = document.getElementById('notificationsButton');
  const settingsButton = document.getElementById('settingsButton');

  if (button) {
    button.textContent = currentUser ? 'Login' : 'Login';
    button.style.display = currentUser ? 'none' : '';
  }

  if (newButton) newButton.style.display = currentUser ? '' : 'none';
  if (notificationsButton) notificationsButton.style.display = currentUser ? '' : 'none';
  if (settingsButton) settingsButton.style.display = currentUser ? '' : 'none';

  const editHeader = document.getElementById('editHeader');
  if (editHeader) editHeader.style.display = currentUser ? '' : 'none';

  document.querySelectorAll('[data-edit]').forEach(button => {
    button.style.display = currentUser ? '' : 'none';
  });

  const deleteButton = document.getElementById('delete');
  if (deleteButton) {
    deleteButton.style.display = currentUser ? '' : 'none';
  }

  const exportButton = document.getElementById('export');
  if (exportButton) {
    exportButton.style.display = currentUser ? '' : 'none';
  }

  const importButton = document.getElementById('import');
  const importLabel = importButton?.closest('label.button');
  if (importLabel) {
    importLabel.style.display = currentUser ? '' : 'none';
  }

  document.querySelectorAll('.week-change').forEach(element => {
    element.style.display = currentUser ? '' : 'none';
  });
}

function openSettingsDialog() {
  let dialog = document.getElementById('dgslSettingsDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'dgslSettingsDialog';
    dialog.className = 'header-settings-dialog';
    dialog.innerHTML = `
      <div class="header-dialog-inner">
        <div class="header-dialog-head">
          <div>
            <p class="eyebrow">DGSL SITE REGISTER</p>
            <h2>Settings</h2>
          </div>
          <button type="button" class="icon" id="closeSettings" aria-label="Close">×</button>
        </div>
        <div class="settings-options">
          <button type="button" id="settingsChangeLog" class="settings-option">Change Log</button>
          <button type="button" id="settingsLogout" class="settings-option settings-logout">Log out</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('#closeSettings').onclick = () => dialog.close();
    dialog.querySelector('#settingsChangeLog').onclick = () => {
      dialog.close();
      openChangeLogDialog();
    };
    dialog.querySelector('#settingsLogout').onclick = () => {
      dialog.close();
      showLogoutConfirmDialog();
    };
  }
  if (!dialog.open) dialog.showModal();
}

function getSeenNotificationIds() {
  try {
    const value = localStorage.getItem(NOTIFICATIONS_SEEN_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function setSeenNotificationIds(ids) {
  try {
    localStorage.setItem(
      NOTIFICATIONS_SEEN_KEY,
      JSON.stringify(Array.from(new Set(ids)).slice(-100))
    );
  } catch (_) {}
}

function markNotificationsSeen(notifications) {
  const seen = getSeenNotificationIds();
  const ids = notifications.map(n => String(n.id));
  setSeenNotificationIds([...seen, ...ids]);
  updateNotificationBadge(0);
}

function notificationMessageHtml(notification) {
  const version = String(notification.version || '').replace(/[<>&"']/g, '');
  const title = String(notification.title || 'Website updated').replace(/[<>&"']/g, '');
  const message = String(notification.message || '').replace(/[<>&"']/g, '');
  return `
    <article class="site-notification-card">
      <div class="site-notification-title">${title}</div>
      ${version ? `<div class="site-notification-version">Version ${version}</div>` : ''}
      <div class="site-notification-message">${message}</div>
      <button type="button" class="primary site-notification-refresh">Refresh Website</button>
    </article>
  `;
}

async function loadSiteNotifications() {
  if (!supabaseClient || !currentUser) {
    updateNotificationBadge(0);
    return [];
  }

  try {
    const { data, error } = await supabaseClient
      .from(NOTIFICATIONS_TABLE)
      .select('id,version,title,message,created_at')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw error;

    const notifications = Array.isArray(data) ? data : [];
    const seen = new Set(getSeenNotificationIds());
    const unseen = notifications.filter(n => !seen.has(String(n.id)));
    updateNotificationBadge(unseen.length);
    return unseen;
  } catch (error) {
    console.warn('Notifications could not be loaded:', error);
    updateNotificationBadge(0);
    return [];
  }
}

async function openNotificationsDialog() {
  let dialog = document.getElementById('dgslNotificationsDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'dgslNotificationsDialog';
    dialog.className = 'header-settings-dialog notifications-dialog';
    dialog.innerHTML = `
      <div class="header-dialog-inner">
        <div class="header-dialog-head">
          <div>
            <p class="eyebrow">DGSL SITE REGISTER</p>
            <h2>Notifications</h2>
          </div>
          <button type="button" class="icon" id="closeNotifications" aria-label="Close">×</button>
        </div>
        <div id="notificationsContent" class="notifications-content">
          <div class="notifications-empty">Loading notifications...</div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#closeNotifications').onclick = () => dialog.close();
  }

  const content = dialog.querySelector('#notificationsContent');
  content.innerHTML = '<div class="notifications-empty">Loading notifications...</div>';
  if (!dialog.open) dialog.showModal();

  const notifications = await loadSiteNotifications();

  if (!notifications.length) {
    content.innerHTML = '<div class="notifications-empty">No new notifications.</div>';
    return;
  }

  content.innerHTML = notifications.map(notificationMessageHtml).join('');
  content.querySelectorAll('.site-notification-refresh').forEach(button => {
    button.addEventListener('click', () => {
      markNotificationsSeen(notifications);
      dialog.close();
      const url = new URL(window.location.href);
      url.searchParams.set('refresh', String(Date.now()));
      window.location.replace(url.toString());
    });
  });

}

function updateNotificationBadge(count = 0) {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;
  const safeCount = Math.max(0, Number(count) || 0);
  badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
  badge.hidden = safeCount === 0;
}

async function refreshNotificationState() {
  if (!currentUser) {
    updateNotificationBadge(0);
    if (notificationPollTimer) {
      clearInterval(notificationPollTimer);
      notificationPollTimer = null;
    }
    return;
  }

  await loadSiteNotifications();

  if (!notificationPollTimer) {
    notificationPollTimer = setInterval(() => {
      if (currentUser && document.visibilityState === 'visible') {
        refreshNotificationState();
      }
    }, 60000);
  }
}

function openChangeLogDialog() {
  const dialog = document.getElementById('changeLogDialog');
  const close = document.getElementById('closeChangeLog');
  if (!dialog) return;
  const shut = () => {
    if (dialog.open) dialog.close();
    document.documentElement.classList.remove('change-log-open');
    document.body.classList.remove('change-log-open');
  };
  if (close && !close.dataset.bound) {
    close.dataset.bound = '1';
    close.addEventListener('click', shut);
  }
  if (!dialog.open) {
    document.documentElement.classList.add('change-log-open');
    document.body.classList.add('change-log-open');
    dialog.showModal();
  }
}

function showLogoutConfirmDialog() {
  let dialog = document.getElementById('dgslLogoutDialog');

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'dgslLogoutDialog';
    dialog.style.padding = '0';
    dialog.style.border = '0';
    dialog.style.borderRadius = '12px';
    dialog.style.width = 'min(360px, calc(100% - 32px))';
    dialog.style.maxWidth = '360px';
    dialog.style.boxSizing = 'border-box';
    dialog.style.margin = 'auto';
    dialog.style.overflow = 'hidden';

    dialog.innerHTML = `
      <div style="padding:22px;text-align:center;box-sizing:border-box;">
        <div style="font-size:20px;font-weight:700;margin-bottom:10px;">
          Log out?
        </div>
        <div style="font-size:16px;margin-bottom:20px;">
          Are you sure you want to log out?
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" id="dgslLogoutCancel">Cancel</button>
          <button type="button" id="dgslLogoutConfirm" style="background:#008e39;color:#fff;border-color:#008e39;">Log out</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#dgslLogoutCancel').onclick = () => {
      dialog.close();
    };

    dialog.querySelector('#dgslLogoutConfirm').onclick = async () => {
      const confirmButton = dialog.querySelector('#dgslLogoutConfirm');
      confirmButton.disabled = true;
      confirmButton.textContent = 'Logging out...';

      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        confirmButton.disabled = false;
        confirmButton.textContent = 'Log out';
        alert('Unable to log out. Please try again.');
        return;
      }

      dialog.close();
    };
  }

  if (!dialog.open) {
    dialog.showModal();
  }
}


function showAuthDialog() {
  if (!authDialog) {
    authDialog = document.createElement('dialog');
    authDialog.id = 'dgslAuthDialog';
    authDialog.style.padding = '0';
    authDialog.style.border = '0';
    authDialog.style.borderRadius = '12px';
    authDialog.style.maxWidth = '360px';
    authDialog.style.width = 'calc(100% - 32px)';

    authDialog.innerHTML = `
      <div style="padding:22px;">
        <div style="font-size:20px;font-weight:700;margin-bottom:16px;">
          DGSL Site Register Login
        </div>
        <label style="display:block;margin-bottom:6px;font-weight:600;">Password</label>
        <input id="dgslLoginPassword" type="password" autocomplete="current-password"
          style="width:100%;box-sizing:border-box;margin-bottom:12px;">
        <div id="dgslAuthStatus" style="min-height:20px;margin-bottom:12px;font-size:14px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" id="dgslLoginCancel">Cancel</button>
          <button type="button" id="dgslLoginSubmit" style="background:#008e39;color:#fff;border-color:#008e39;">Login</button>
        </div>
      </div>
    `;

    document.body.appendChild(authDialog);

    authDialog.querySelector('#dgslLoginCancel').onclick = () => authDialog.close();

    authDialog.querySelector('#dgslLoginSubmit').onclick = async () => {
      const email = 'elvira@dgsl.ie';
      const password = authDialog.querySelector('#dgslLoginPassword').value;
      const status = authDialog.querySelector('#dgslAuthStatus');

      if (!email || !password) {
        status.textContent = 'Please enter your password.';
        return;
      }

      status.textContent = 'Logging in...';

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        status.textContent = error.message;
        return;
      }

      status.textContent = '';
      authDialog.close();
    };
  }

  authDialog.showModal();
}


// ============================================================
// START SUPABASE
// ============================================================

async function loadSupabase() {

  if (!window.supabase) {

    await new Promise((resolve, reject) => {

      const script =
        document.createElement('script');

      script.src =
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);

    });

  }

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

}


// ============================================================
// ADD LOGO TO HANDOVER FORM
// ============================================================

function addLogoToForm() {

  const formHead =
    form.querySelector('.form-head');

  if (!formHead) {
    return;
  }

  if (
    form.querySelector(
      '#handoverFormLogo'
    )
  ) {
    return;
  }

  const logo =
    document.createElement('img');

  logo.id =
    'handoverFormLogo';

  logo.src =
    LOGO_FILE;

  logo.alt =
    'DGSL Logo';

  logo.style.display =
    'block';

  logo.style.width =
    '220px';

  logo.style.maxWidth =
    '70%';

  logo.style.height =
    'auto';

  logo.style.objectFit =
    'contain';

  logo.style.margin =
    '0 auto 15px auto';

  formHead.parentNode.insertBefore(
    logo,
    formHead
  );

}


// ============================================================
// DATABASE → WEBSITE
// ============================================================

function fromDatabase(x) {

  let photos = [];

// Photos selected during the current New/Edit session.
// This must be kept separately from the file input because mobile
// browsers replace input.files when the camera/gallery is opened again.
let pendingPhotoFiles = [];
let photosToRemove = [];

  try {

    photos =
      x.photos
        ? JSON.parse(x.photos)
        : [];

  } catch {

    photos = [];

  }


  let takeBackChecklist = {};

  try {

    takeBackChecklist =
      x.take_back_checklist
        ? JSON.parse(
            x.take_back_checklist
          )
        : {};

  } catch {

    takeBackChecklist = {};

  }


  return {

    id:
      x.id,

    zone:
      x.zone || '',

    level:
      x.level || '',

    drawing:
      x.drawing || '',

    trade:
      x.trade || '',

    contractor:
      x.contractor || '',

    foreman:
      x.foreman || '',

    description:
      x.description || '',

    status:
      x.status || '',

    handover:
      x.handover || '',

    handoverDate:
      x.handover_date || '',

    takeBackDate:
      x.take_back_date || '',
    
    closedDate:
      x.closed_date || '',

    notes:
      x.notes || '',

    contractorSigner:
      x.contractor_signer || '',

    dgslSigner:
      x.dgsl_signer || '',

    contractorSignature:
      x.contractor_signature || '',

    dgslSignature:
      x.dgsl_signature || '',

    photos:
      photos,

    healthSafetyScaffolding:
      x.health_safety_scaffolding || '',

    takeBackCompleteDrawings:
      x.take_back_complete_drawings || '',

    takeBackHousekeeping:
      x.take_back_housekeeping || '',

    takeBackSnagCompleted:
      x.take_back_snag_completed || '',

    takeBackChecklist:
      takeBackChecklist

  };

}


// ============================================================
// WEBSITE → DATABASE
// ============================================================

function toDatabase(x) {

  return {

    id:
      x.id,

    zone:
      x.zone || null,

    level:
      x.level || null,

    drawing:
      x.drawing || null,

    trade:
      x.trade || null,

    contractor:
      x.contractor || null,

    foreman:
      x.foreman || null,

    description:
      x.description || null,

    status:
      x.status || null,

    handover:
      x.handover || null,

    handover_date:
      x.handoverDate || null,

    take_back_date:
      x.takeBackDate || null,

    closed_date:
      null,

    notes:
      x.notes || null,

    contractor_signer:
      x.contractorSigner || null,

    dgsl_signer:
      x.dgslSigner || null,

    contractor_signature:
      x.contractorSignature || null,

    dgsl_signature:
      x.dgslSignature || null,

    photos:
      JSON.stringify(
        x.photos || []
      ),

    health_safety_scaffolding:
      x.healthSafetyScaffolding || null,

    take_back_complete_drawings:
      x.takeBackCompleteDrawings || null,

    take_back_housekeeping:
      x.takeBackHousekeeping || null,

    take_back_snag_completed:
      x.takeBackSnagCompleted || null,

    take_back_checklist:
      JSON.stringify(
        x.takeBackChecklist || {}
      )

  };

}


// ============================================================
// LOAD RECORDS
// ============================================================

async function loadRecords() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('handovers_test')
        .select('*');

    if (error) {
      throw error;
    }

    records =
      (data || [])
        .map(fromDatabase);

    render();

  } catch (error) {

    console.error(
      'Load error:',
      error
    );

    alert(
      'Could not load the handover register.'
    );

  }

}


// ============================================================
// REAL-TIME UPDATES
// ============================================================

function setupRealtime() {

  supabaseClient
    .channel('handovers-test-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'handovers_test'
      },
      async () => {

        await loadRecords();

      }
    )
    .subscribe();

}


// ============================================================
// HTML ESCAPE
// ============================================================

function formatTableDate(value) {
  if (!value) return '—';

  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return String(value);

  return `${match[3]}/${match[2]}/${match[1].slice(2)}`;
}


function formatDate(value) {
  if (!value) return '';

  const text = String(value).slice(0, 10);

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return String(value);

  return `${match[3]}-${match[2]}-${match[1]}`;
}


function isThisWeek(value) {

  if (!value) return false;

  const text = String(value).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) return false;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const day = todayDate.getDay();
  const daysFromMonday = (day + 6) % 7;

  const startOfWeek = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - daysFromMonday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}


function updateWeekChange(id, count) {

  const element = $(`#${id}`);

  if (!element) return;

  element.textContent =
    count > 0
      ? `↑ ${count} this week`
      : 'No change';
}


function esc(x = '') {

  return String(x)
    .replace(
      /[&<>"']/g,
      c => ({

        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'

      }[c])
    );

}


// ============================================================
// RENDER
// ============================================================

function render() {

  const q =
    $('#search')
      ? $('#search')
          .value
          .toLowerCase()
      : '';

  const filtered =
    records
      .filter(x =>

        (
          filter === 'All' ||
          x.status === filter
        )

        &&

        Object.values(x)
          .join(' ')
          .toLowerCase()
          .includes(q)

      )
      .sort((a, b) => {
        const aDate = String(a.handoverDate || '');
        const bDate = String(b.handoverDate || '');
        return bDate.localeCompare(aDate);
      });


  $('#total').textContent =
    records.length;


  $('#progress').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit Open'
    ).length;


  $('#closed').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit Closed'
    ).length;


  $('#hold').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit on Hold'
    ).length;


  const thisWeek =
    records.filter(x => isThisWeek(x.handoverDate));

  updateWeekChange('totalWeek', thisWeek.length);

  updateWeekChange(
    'progressWeek',
    thisWeek.filter(
      x => x.status === 'Work Permit Open'
    ).length
  );

  updateWeekChange(
    'closedWeek',
    thisWeek.filter(
      x => x.status === 'Work Permit Closed'
    ).length
  );

  updateWeekChange(
    'holdWeek',
    thisWeek.filter(
      x => x.status === 'Work Permit on Hold'
    ).length
  );


  rows.innerHTML =
    filtered
      .map(
        x => `

        <tr class="${x.handover === 'COPY' ? 'copied-handover-row' : ''}" data-row-id="${esc(x.id)}">

          <td>
            <b>
              ${esc(x.zone)}
            </b>
          </td>

          <td>
            ${esc(x.contractor)}
          </td>

          <td>
            ${esc(x.description)}
          </td>

          <td>

  <span
    class="status ${
      x.status === 'Work Permit Open'
        ? 'status-open'
        : x.status === 'Work Permit Closed'
          ? 'status-closed'
          : x.status === 'Work Permit on Hold'
            ? 'status-hold'
            : ''
    }"
  >
    ${esc(x.status)}
  </span>

</td>

          <td class="table-date">
  ${esc(formatTableDate(x.handoverDate))}
</td>

          <td class="table-date">
  ${esc(formatTableDate(x.takeBackDate))}
</td>


${currentUser ? `
          <td>
            <button
              type="button"
              data-edit="${esc(x.id)}"
            >
              Edit
            </button>
          </td>
          ` : ''}

          <td>
            <button
              type="button"
              data-view="${esc(x.id)}"
            >
              View
            </button>
          </td>

        </tr>

        `
      )
      .join('');


  $('#empty')
    .classList
    .toggle(
      'hidden',
      filtered.length > 0
    );


  async function loadPdfJs() {

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  await new Promise(
    (resolve, reject) => {

      const script =
        document.createElement('script');

      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

      script.onload =
        resolve;

      script.onerror =
        reject;

      document.head.appendChild(script);

    }
  );

  if (!window.pdfjsLib) {

    throw new Error(
      'PDF viewer library could not be loaded.'
    );

  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  return window.pdfjsLib;

}


document
    .querySelectorAll(
      '[data-view]'
    )
    .forEach(
      button => {

        button.onclick =
          async function () {

            const id =
              this.getAttribute(
                'data-view'
              );

            const record =
              records.find(
                x => String(x.id) === String(id)
              );

            if (!record) return;

            try {

              open(record, false);

              const blob =
                await generatePdf(true);

              const arrayBuffer =
                await blob.arrayBuffer();

              const pdfjsLib =
                await loadPdfJs();

              const pdf =
                await pdfjsLib.getDocument({
                  data: new Uint8Array(arrayBuffer)
                }).promise;

              const viewer =
                $('#pdfViewer');

              viewer.innerHTML = '';

              for (
                let pageNumber = 1;
                pageNumber <= pdf.numPages;
                pageNumber++
              ) {

                const page =
                  await pdf.getPage(pageNumber);

                const viewport =
                  page.getViewport({
                    scale: 1.25
                  });

                const canvas =
                  document.createElement('canvas');

                const context =
                  canvas.getContext('2d');

                canvas.width =
                  viewport.width;

                canvas.height =
                  viewport.height;

                canvas.style.display =
                  'block';

                canvas.style.width =
                  '100%';

                canvas.style.height =
                  'auto';

                canvas.style.marginBottom =
                  '12px';

                canvas.style.background =
                  '#fff';

                viewer.appendChild(canvas);

                await page.render({
                  canvasContext: context,
                  viewport: viewport
                }).promise;

              }

              const pdfDialog = $('#pdfDialog');
              const pdfInner = pdfDialog.querySelector(':scope > div');

              // Match the handover form window exactly.
              pdfDialog.style.width = 'min(950px, 94vw)';
              pdfDialog.style.maxWidth = '950px';
              pdfDialog.style.height = '82vh';
              pdfDialog.style.maxHeight = '82vh';
              pdfDialog.style.minHeight = '0';
              pdfDialog.style.padding = '0';
              pdfDialog.style.overflow = 'hidden';
              pdfDialog.style.boxSizing = 'border-box';

              if (pdfInner) {
                pdfInner.style.height = '100%';
                pdfInner.style.maxHeight = 'none';
                pdfInner.style.minHeight = '0';
                pdfInner.style.overflow = 'hidden';
                pdfInner.style.boxSizing = 'border-box';
              }

              viewer.style.height = 'auto';
              viewer.style.minHeight = '0';
              viewer.style.overflowY = 'auto';
              viewer.style.overflowX = 'hidden';
              viewer.style.overscrollBehavior = 'contain';
              viewer.style.touchAction = 'pan-y';

              lockPdfDialogBackground();
              document.documentElement.classList.add('pdf-dialog-open');
              pdfDialog.showModal();

            } catch (error) {

              console.error(error);

              unlockPdfDialogBackground();

              alert(
                'Unable to generate the PDF.'
              );

            }

          };

      }
    );

  document
    .querySelectorAll(
      '[data-edit]'
    )
    .forEach(
      button => {

        button.onclick =
          function () {

            const id =
              this.getAttribute(
                'data-edit'
              );

            const record =
              records.find(
                x =>
                  String(x.id) ===
                  String(id)
              );

            if (record && currentUser) {
              open(record);
            }

          };

      }
    );


  // Make the whole handover row clickable.
  // Use event delegation on the table body so this also works
  // reliably after filtering/searching and on mobile browsers.
  rows.onclick =
    function (event) {

      let element = event.target;

      // Do not trigger the row action when an existing button is tapped.
      while (element && element !== rows) {

        if (element.tagName === 'BUTTON' || element.tagName === 'A') {
          return;
        }

        if (element.tagName === 'TR') {

          const id =
            element.getAttribute('data-row-id');

          if (id) {
            showRowActionDialog(id);
          }

          return;
        }

        element = element.parentElement;
      }

    };


}


// ============================================================
// WHOLE-ROW ACTION POPUP
// ============================================================

function lockFormDialogBackground() {
  document.body.classList.add('form-dialog-open');
}

function unlockFormDialogBackground() {
  document.body.classList.remove('form-dialog-open');
}

function lockPdfDialogBackground() {
  document.body.classList.add('pdf-dialog-open');
}

function unlockPdfDialogBackground() {
  document.body.classList.remove('pdf-dialog-open');
}

function showRowActionDialog(id) {

  const record =
    records.find(
      x => String(x.id) === String(id)
    );

  if (!record) return;

  let dialog =
    document.getElementById('rowActionDialog');

  if (!dialog) {

    dialog =
      document.createElement('dialog');

    dialog.id =
      'rowActionDialog';

    dialog.style.padding = '0';
    dialog.style.border = '0';
    dialog.style.borderRadius = '12px';
    dialog.style.maxWidth = '340px';
    dialog.style.width = 'calc(100% - 32px)';
    dialog.style.height = 'auto';
    dialog.style.minHeight = '0';
    dialog.style.maxHeight = 'none';
    dialog.style.margin = 'auto';
    dialog.style.boxSizing = 'border-box';
    dialog.style.overflow = 'hidden';

    dialog.style.setProperty('position', 'fixed', 'important');
    dialog.style.setProperty('top', '50%', 'important');
    dialog.style.setProperty('left', '50%', 'important');
    dialog.style.setProperty('right', 'auto', 'important');
    dialog.style.setProperty('bottom', 'auto', 'important');
    dialog.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
    dialog.style.setProperty('width', 'min(340px, calc(100vw - 32px))', 'important');
    dialog.style.setProperty('height', '190px', 'important');
    dialog.style.setProperty('min-height', '190px', 'important');
    dialog.style.setProperty('max-height', '190px', 'important');

    document.body.appendChild(dialog);
  }

  // Rebuild the popup every time it is opened so the available
  // actions always match the current login state.
  dialog.innerHTML = `
    <div style="padding:22px; text-align:center; height:auto; min-height:0; max-height:none; box-sizing:border-box;">
      <div style="font-size:18px; font-weight:700; margin-bottom:18px;">
        What would you like to do?
      </div>
      <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        ${currentUser ? '<button type="button" id="rowActionEdit">Edit</button>' : ''}
        ${currentUser ? '<button type="button" id="rowActionCopy">Copy</button>' : ''}
        <button type="button" id="rowActionView">View PDF</button>
        <button type="button" id="rowActionDownload">Download PDF</button>
        <button type="button" id="rowActionCancel">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('rowActionCancel').onclick =
    () => dialog.close();

  const rowEditButton =
    document.getElementById('rowActionEdit');

  if (rowEditButton) {
    rowEditButton.onclick =
      () => {
        if (!currentUser) {
          dialog.close();
          return;
        }

        dialog.close();
        setTimeout(() => open(record), 0);
      };
  }

  document.getElementById('rowActionView').onclick =
    () => {
      dialog.close();
      setTimeout(() => {

        // Call the existing View button without relying on CSS.escape.
        const viewButtons =
          document.querySelectorAll('[data-view]');

        for (const button of viewButtons) {

          if (
            String(button.getAttribute('data-view')) ===
            String(id)
          ) {
            button.click();
            break;
          }

        }

      }, 0);
    };

  const rowDownloadButton =
    document.getElementById('rowActionDownload');

  if (rowDownloadButton) {
    rowDownloadButton.onclick =
      async () => {
        dialog.close();

        try {
          open(record, false);
          await generatePdf(false);
        } catch (error) {
          console.error('PDF download error:', error);
          alert('Unable to download the PDF.');
        }
      };
  }

  const rowCopyButton =
    document.getElementById('rowActionCopy');

  if (rowCopyButton) {
    rowCopyButton.onclick =
      () => {
        if (!currentUser) {
          dialog.close();
          return;
        }

        dialog.close();
        setTimeout(() => showCopyConfirmDialog(record), 0);
      };
  }

  if (!dialog.open) {
    dialog.showModal();
  }

}


// ============================================================
// CHECKLIST
// ============================================================

function getTakeBackChecklist() {

  const result = {};

  document
    .querySelectorAll(
      '.takeback-check'
    )
    .forEach(
      checkbox => {

        const item =
          checkbox.dataset.item;

        const answer =
          checkbox.dataset.answer;

        if (!result[item]) {
          result[item] = '';
        }

        if (checkbox.checked) {
          result[item] = answer;
        }

      }
    );

  return result;

}


// ============================================================
// RESTORE CHECKLIST
// ============================================================

function restoreTakeBackChecklist(
  checklist
) {

  document
    .querySelectorAll(
      '.takeback-check'
    )
    .forEach(
      checkbox => {

        const item =
          checkbox.dataset.item;

        const answer =
          checkbox.dataset.answer;


        if (
          checklist &&
          checklist[item]
        ) {

          checkbox.checked =
            checklist[item] === answer;

        } else {

          checkbox.checked =
            answer === 'yes';

        }

      }
    );

}


// ============================================================
// CHECKLIST YES / NO BEHAVIOUR
// ============================================================

document
  .querySelectorAll(
    '.takeback-check'
  )
  .forEach(
    checkbox => {

      checkbox.addEventListener(
        'change',
        function () {

          const item =
            this.dataset.item;

          const answer =
            this.dataset.answer;


          if (
            this.checked &&
            answer === 'no'
          ) {

            document
              .querySelectorAll(
                `.takeback-check[data-item="${item}"]`
              )
              .forEach(
                other => {

                  if (
                    other.dataset.answer ===
                    'yes'
                  ) {

                    other.checked =
                      false;

                  }

                }
              );

          }


          if (
            this.checked &&
            answer === 'yes'
          ) {

            document
              .querySelectorAll(
                `.takeback-check[data-item="${item}"]`
              )
              .forEach(
                other => {

                  if (
                    other.dataset.answer ===
                    'no'
                  ) {

                    other.checked =
                      false;

                  }

                }
              );

          }

        }
      );

    }
  );

// ============================================================
// OTHER DROPDOWN BEHAVIOUR
// ============================================================

function setupOtherDropdown(
  selectName,
  otherId
) {

  const select =
    form.elements[selectName];

  const other =
    document.getElementById(otherId);

  if (!select || !other) {
    return;
  }

  // Create a container around the dropdown and Other box
  const wrapper =
    document.createElement('div');

  wrapper.style.position =
    'relative';

  wrapper.style.width =
    '100%';

  // Put both controls inside the wrapper
  select.parentNode.insertBefore(
    wrapper,
    select
  );

  wrapper.appendChild(select);
  wrapper.appendChild(other);

  // Normal dropdown fills the whole field
  select.style.width =
    '100%';

  select.style.boxSizing =
    'border-box';

  // Other box starts hidden
  other.style.display =
    'none';

  other.disabled =
    true;

  select.addEventListener(
    'change',
    function () {

      if (this.value === 'Other') {

        // Keep the original dropdown visible,
        // including its original arrow.

        other.style.display =
          '';

        other.disabled =
          false;

        // Put the text box over the dropdown,
        // leaving the arrow area visible.
        other.style.position =
          'absolute';

        other.style.left =
          '0';

        other.style.top =
          '6px';

        other.style.width =
          'calc(100% - 45px)';

        other.style.height =
          'calc(100% - 6px)';

        other.style.boxSizing =
          'border-box';

        other.style.margin =
          '0';

        other.style.zIndex =
          '2';

        other.focus();

      } else {

        // A normal option was selected.
        other.style.display =
          'none';

        other.disabled =
          true;

        other.value =
          '';

        other.style.position =
          '';

        other.style.width =
          '';

        other.style.height =
          '';

        other.style.zIndex =
          '';
      }

    }
  );

}


setupOtherDropdown(
  'level',
  'levelOther'
);

setupOtherDropdown(
  'trade',
  'tradeOther'
);

setupOtherDropdown(
  'foreman',
  'foremanOther'
);

setupOtherDropdown(
  'healthSafetyScaffolding',
  'healthSafetyScaffoldingOther'
);

setupOtherDropdown(
  'status',
  'statusOther'
);

setupOtherDropdown(
  'takeBackCompleteDrawings',
  'takeBackCompleteDrawingsOther'
);

setupOtherDropdown(
  'takeBackHousekeeping',
  'takeBackHousekeepingOther'
);

setupOtherDropdown(
  'takeBackSnagCompleted',
  'takeBackSnagCompletedOther'
);

// Automatically close the work permit when the DGSL representative
// field is filled in. The status dropdown remains editable afterwards.
const dgslRepresentativeField = form.elements.dgslSigner;
const statusField = form.elements.status;

if (dgslRepresentativeField && statusField) {
  dgslRepresentativeField.addEventListener('input', () => {
    if (dgslRepresentativeField.value.trim()) {
      statusField.value = 'Work Permit Closed';
      statusField.dispatchEvent(new Event('change'));
    }
  });
}

// ============================================================
// OPEN FORM
// ============================================================

function open(x, showDialog = true) {

  editing =
    x || null;


  $('#formTitle')
    .textContent =
      x
        ? 'Edit handover'
        : 'New handover';


  $('#delete')
    .classList
    .toggle(
      'hidden',
      !x
    );


  form.reset();

// Reset all dropdowns to their normal state
document.querySelectorAll('select').forEach(
  select => {
    select.style.display = '';
  }
);

// Hide all Other text boxes
document.querySelectorAll(
  'input[id$="Other"]'
).forEach(
  input => {
    input.style.display = 'none';
    input.disabled = true;
    input.value = '';
  }
);

// Hide all Change buttons
document.querySelectorAll(
  'button[id$="OtherChange"]'
).forEach(
  button => {
    button.style.display = 'none';
  }
);

clearSignature(
  $('#contractorSignature')
);


  clearSignature(
    $('#dgslSignature')
  );


  $('#photoPreview')
    .innerHTML =
      '';

  // Start a fresh pending-photo list for this New/Edit session.
  pendingPhotoFiles = [];
  photosToRemove = [];


  restoreTakeBackChecklist(
    {}
  );


  const values =
    x || {

      handoverDate:
        today(),

      status:
        'Work Permit Open'

    };


  for (
    const [key, value]
    of Object.entries(values)
  ) {

    const element =
      form.elements[key];


    if (!element) {
      continue;
    }


    if (
      element.type ===
      'file'
    ) {

      continue;

    }


    if (
      key === 'photos'
    ) {

      continue;

    }


    if (
      key ===
      'takeBackChecklist'
    ) {

      continue;

    }


    if (
  element.tagName === 'SELECT' &&
  element.value !== value
) {

  const otherField =
    document.getElementById(
      element.name + 'Other'
    );

  const optionExists =
    Array.from(element.options)
      .some(
        option =>
          option.value === value
      );

  if (optionExists) {

    element.value =
      value || '';

    if (otherField) {

      otherField.style.display =
        'none';

      otherField.disabled =
        true;

      otherField.value =
        '';
    }

  } else {

    element.value =
      'Other';

    if (otherField) {

// Keep the original dropdown visible
// so its arrow remains available.
element.style.display =
  '';

otherField.style.display =
  '';

      otherField.disabled =
        false;

      otherField.value =
        value || '';

    }

  }

} else {

  element.value =
    value || '';

}

  }


  if (x) {

    drawSavedSignature(
      $('#contractorSignature'),
      x.contractorSignature
    );


    drawSavedSignature(
      $('#dgslSignature'),
      x.dgslSignature
    );


    showSavedPhotos(
      x.photos
    );


    restoreTakeBackChecklist(
      x.takeBackChecklist
    );

  }


  if (showDialog) {
    lockFormDialogBackground();
    dlg.showModal();
  }

}


// ============================================================
// NEW HANDOVER
// ============================================================

$('#newZone').onclick =
  () => {
    if (currentUser) open();
  };


// ============================================================
// CANCEL
// ============================================================

$('#cancel').onclick =
$('#cancel2').onclick =
  () => {
    unlockFormDialogBackground();
    dlg.close();
  };


// ============================================================
// ADD PHOTOS
// ============================================================

// Mobile camera/gallery pickers replace the contents of the file
// input each time they are opened. Accumulate each selection here.
if (form.elements.photos) {

  form.elements.photos.onchange =
    e => {

      const selected =
        Array.from(
          e.target.files || []
        ).filter(
          file =>
            file.type.startsWith('image/')
        );

      if (selected.length) {

        pendingPhotoFiles.push(
          ...selected
        );

        renderPendingPhotoPreviews();

      }

      // Clear the input so the user can choose/take another photo,
      // including the same file again if needed.
      e.target.value = '';

    };

}

function renderPendingPhotoPreviews() {

  const preview =
    $('#photoPreview');

  if (!preview) {
    return;
  }

  preview.innerHTML = '';

  if (editing?.photos) {
    showSavedPhotos(editing.photos);
  }

  pendingPhotoFiles.forEach((file, index) => {

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.position = 'relative';
    wrapper.style.marginRight = '6px';
    wrapper.style.marginBottom = '6px';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.width = '110px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.style.border = '2px solid #1976d2';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Remove photo';
    remove.style.position = 'absolute';
    remove.style.top = '2px';
    remove.style.right = '2px';
    remove.style.width = '28px';
    remove.style.height = '28px';
    remove.style.padding = '0';
    remove.style.borderRadius = '50%';
    remove.style.border = '1px solid #fff';
    remove.style.background = '#d32f2f';
    remove.style.color = '#fff';
    remove.style.fontSize = '20px';
    remove.style.lineHeight = '24px';
    remove.style.cursor = 'pointer';
    remove.onclick = () => {
      pendingPhotoFiles.splice(index, 1);
      renderPendingPhotoPreviews();
    };

    wrapper.appendChild(img);
    wrapper.appendChild(remove);
    preview.appendChild(wrapper);
  });
}


// ============================================================
// SAVE HANDOVER
// ============================================================

form.onsubmit =
  async e => {

    e.preventDefault();


    const saveButton =
      form.querySelector(
        'button[value="default"]'
      );


    try {

      if (saveButton) {

        saveButton.disabled =
          true;

        saveButton.textContent =
          'Saving...';

      }


      const x =
        Object.fromEntries(
          new FormData(form)
        );
      if (
  form.elements.level?.value === 'Other'
) {
  x.level =
    document.getElementById(
      'levelOther'
    ).value || 'Other';
}

if (
  form.elements.trade?.value === 'Other'
) {
  x.trade =
    document.getElementById(
      'tradeOther'
    ).value || 'Other';
}

if (
  form.elements.foreman?.value === 'Other'
) {
  x.foreman =
    document.getElementById(
      'foremanOther'
    ).value || 'Other';
}

if (
  form.elements.healthSafetyScaffolding?.value === 'Other'
) {
  x.healthSafetyScaffolding =
    document.getElementById(
      'healthSafetyScaffoldingOther'
    ).value || 'Other';
}

if (
  form.elements.status?.value === 'Other'
) {
  x.status =
    document.getElementById(
      'statusOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackCompleteDrawings?.value === 'Other'
) {
  x.takeBackCompleteDrawings =
    document.getElementById(
      'takeBackCompleteDrawingsOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackHousekeeping?.value === 'Other'
) {
  x.takeBackHousekeeping =
    document.getElementById(
      'takeBackHousekeepingOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackSnagCompleted?.value === 'Other'
) {
  x.takeBackSnagCompleted =
    document.getElementById(
      'takeBackSnagCompletedOther'
    ).value || 'Other';
}
      


      x.id =
        editing?.id ||
        crypto.randomUUID();


      // ------------------------------------------------------
      // TAKE BACK CHECKLIST
      // ------------------------------------------------------

      x.takeBackChecklist =
        getTakeBackChecklist();


      // ------------------------------------------------------
      // SIGNATURES
      // ------------------------------------------------------

      x.contractorSignature =
        $('#contractorSignature')
          .toDataURL(
            'image/png'
          );


      x.dgslSignature =
        $('#dgslSignature')
          .toDataURL(
            'image/png'
          );


      // ------------------------------------------------------
      // EXISTING PHOTOS
      // ------------------------------------------------------

      x.photos =
        editing?.photos
          ? editing.photos.filter(
              url => !photosToRemove.includes(url)
            )
          : [];


      // ------------------------------------------------------
// NEW PHOTOS
// ------------------------------------------------------

// Use the accumulated list so taking/selecting another photo
// adds to the previous ones instead of replacing them.
for (
  const file
  of pendingPhotoFiles
) {

  if (
    !file.type.startsWith(
      'image/'
    )
  ) {

    continue;

  }

  const photoUrl =
    await uploadPhoto(
      file,
      x.id
    );

  if (photoUrl) {

    x.photos.push(
      photoUrl
    );

  }

}


      // A copied handover stays marked until it is actually edited and saved.
      if (editing?.handover === 'COPY') {
        x.handover = '';
      }

      // ------------------------------------------------------
      // DATABASE RECORD
      // ------------------------------------------------------

      const databaseRecord =
        toDatabase(x);


      if (editing) {

        const {
          error
        } =
          await supabaseClient
            .from('handovers_test')
            .update(
              databaseRecord
            )
            .eq(
              'id',
              x.id
            );


        if (error) {
          throw error;
        }

      } else {

        const {
          error
        } =
          await supabaseClient
            .from('handovers_test')
            .insert(
              databaseRecord
            );


        if (error) {
          throw error;
        }

      }


      // Delete photos that were removed from the handover.
      for (const url of photosToRemove) {
        await deletePhoto(url);
      }

      unlockFormDialogBackground();
    dlg.close();


      await loadRecords();


    } catch (error) {

      console.error(
        'Save error:',
        error
      );


      alert(
        'There was a problem saving the handover.\n\n' +
        error.message
      );


    } finally {

      if (saveButton) {

        saveButton.disabled =
          false;

        saveButton.textContent =
          'Save handover';

      }

    }

  };


// ============================================================
// COPY HANDOVER
// ============================================================

async function copyPhotoForHandover(
  url,
  newHandoverId
) {

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Could not copy photo (${response.status}).`
    );
  }

  const blob =
    await response.blob();

  let extension =
    'jpg';

  try {
    const marker =
      `/object/public/${PHOTO_BUCKET}/`;

    const index =
      url.indexOf(marker);

    if (index !== -1) {
      const path =
        decodeURIComponent(
          url.substring(index + marker.length)
        );
      const name =
        path.split('/').pop() || '';
      const match =
        name.match(/\.([a-z0-9]+)$/i);
      if (match) {
        extension = match[1].toLowerCase();
      }
    }
  } catch (_) {
    // Keep the default extension if the source URL cannot be parsed.
  }

  const filename =
    `${newHandoverId}/${crypto.randomUUID()}.${extension}`;

  const { error } =
    await supabaseClient
      .storage
      .from(PHOTO_BUCKET)
      .upload(
        filename,
        blob,
        {
          cacheControl: '3600',
          upsert: false,
          contentType: blob.type || undefined
        }
      );

  if (error) {
    throw error;
  }

  const { data } =
    supabaseClient
      .storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(filename);

  return data.publicUrl;

}


function showCopyConfirmDialog(record) {

  let dialog = document.getElementById('dgslCopyConfirmDialog');

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'dgslCopyConfirmDialog';
    dialog.style.padding = '0';
    dialog.style.border = '0';
    dialog.style.borderRadius = '12px';
    dialog.style.width = 'min(360px, calc(100vw - 32px))';
    dialog.style.maxWidth = '360px';
    dialog.style.boxSizing = 'border-box';
    document.body.appendChild(dialog);
  }

  dialog.innerHTML = `
    <div style="padding:22px;text-align:center;box-sizing:border-box;">
      <div style="font-size:18px;font-weight:700;margin-bottom:10px;">
        Create a copy?
      </div>
      <div style="font-size:15px;line-height:1.4;margin-bottom:20px;">
        Are you sure you want to create a copy of this handover?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button type="button" id="copyConfirmCancel">Cancel</button>
        <button type="button" id="copyConfirmYes" class="primary">Create copy</button>
      </div>
    </div>
  `;

  dialog.querySelector('#copyConfirmCancel').onclick =
    () => dialog.close();

  dialog.querySelector('#copyConfirmYes').onclick =
    async () => {
      const confirmButton = dialog.querySelector('#copyConfirmYes');
      confirmButton.disabled = true;
      confirmButton.textContent = 'Creating...';

      try {
        await copyHandover(record);
        dialog.close();
      } catch (error) {
        console.error('Copy handover error:', error);
        alert(
          'There was a problem copying the handover.\n\n' +
          error.message
        );
        confirmButton.disabled = false;
        confirmButton.textContent = 'Create copy';
      }
    };

  if (!dialog.open) {
    dialog.showModal();
  }

}


async function copyHandover(record) {

  if (!currentUser) {
    throw new Error('You must be logged in to copy a handover.');
  }

  const newId =
    crypto.randomUUID();

  const copiedPhotos = [];

  try {

    for (const url of Array.isArray(record.photos) ? record.photos : []) {
      copiedPhotos.push(
        await copyPhotoForHandover(url, newId)
      );
    }

    const copiedRecord = {
      ...record,
      id: newId,
      handoverDate: today(),
      photos: copiedPhotos,
      handover: 'COPY'
    };

    const databaseRecord =
      toDatabase(copiedRecord);

    const { error } =
      await supabaseClient
        .from('handovers_test')
        .insert(databaseRecord);

    if (error) {
      throw error;
    }

    await loadRecords();

    alert('Handover copied.');

  } catch (error) {

    // If photo copying succeeded but the database insert failed, clean up
    // the newly-created copies so the original handover is untouched.
    for (const url of copiedPhotos) {
      await deletePhoto(url);
    }

    throw error;
  }

}


// ============================================================
// UPLOAD PHOTO
// ============================================================

async function uploadPhoto(
  file,
  handoverId
) {

  const extension =
    (
      file.name
        .split('.')
        .pop() ||
      'jpg'
    )
      .toLowerCase();


  const filename =
    `${handoverId}/${crypto.randomUUID()}.${extension}`;


  const {
    error
  } =
    await supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .upload(
        filename,
        file,
        {
          cacheControl:
            '3600',

          upsert:
            false
        }
      );


  if (error) {
    throw error;
  }


  const {
    data
  } =
    supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .getPublicUrl(
        filename
      );


  return data.publicUrl;

}


// ============================================================
// SHOW SAVED PHOTOS
// ============================================================

function showSavedPhotos(
  photos
) {

  const preview = $('#photoPreview');

  if (!preview) {
    return;
  }

  if (!Array.isArray(photos)) {
    return;
  }

  photos.forEach(url => {

    if (photosToRemove.includes(url)) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.position = 'relative';
    wrapper.style.marginRight = '6px';
    wrapper.style.marginBottom = '6px';

    const img = document.createElement('img');
    img.src = url;
    img.style.width = '110px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid #ccc';
    img.style.cursor = 'pointer';
    img.title = 'Click to view photo';
    img.onclick = () => openPhotoViewer(url);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Remove photo';
    remove.style.position = 'absolute';
    remove.style.top = '2px';
    remove.style.right = '2px';
    remove.style.width = '28px';
    remove.style.height = '28px';
    remove.style.padding = '0';
    remove.style.borderRadius = '50%';
    remove.style.border = '1px solid #fff';
    remove.style.background = '#d32f2f';
    remove.style.color = '#fff';
    remove.style.fontSize = '20px';
    remove.style.lineHeight = '24px';
    remove.style.cursor = 'pointer';
    remove.onclick = () => {
      if (!photosToRemove.includes(url)) {
        photosToRemove.push(url);
      }
      renderPendingPhotoPreviews();
    };

    wrapper.appendChild(img);
    wrapper.appendChild(remove);
    preview.appendChild(wrapper);
  });
}


// ============================================================
// PHOTO VIEWER
// ============================================================

function openPhotoViewer(url) {

  let dialog = document.getElementById('photoViewerDialog');

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'photoViewerDialog';
    dialog.innerHTML = `
      <div class="photo-viewer-inner">
        <button type="button" class="photo-viewer-close" aria-label="Close">×</button>
        <img class="photo-viewer-image" alt="Site photo" draggable="false">
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('.photo-viewer-close').onclick = () => dialog.close();
    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close();
    });

    // Zoom the photo itself rather than allowing the browser to zoom the page.
    const image = dialog.querySelector('.photo-viewer-image');
    const state = { scale: 1, pointers: new Map(), pinchDistance: 0, pinchScale: 1 };

    const applyZoom = () => {
      const scale = Math.max(1, Math.min(5, state.scale));
      state.scale = scale;
      image.style.transform = `translate3d(0, 0, 0) scale(${scale})`;
    };

    const distance = (a, b) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    image.addEventListener('pointerdown', e => {
      e.preventDefault();
      image.setPointerCapture?.(e.pointerId);
      state.pointers.set(e.pointerId, e);
      if (state.pointers.size === 2) {
        const pts = [...state.pointers.values()];
        state.pinchDistance = distance(pts[0], pts[1]);
        state.pinchScale = state.scale;
      }
    });

    image.addEventListener('pointermove', e => {
      if (!state.pointers.has(e.pointerId)) return;
      e.preventDefault();
      state.pointers.set(e.pointerId, e);
      if (state.pointers.size === 2 && state.pinchDistance > 0) {
        const pts = [...state.pointers.values()];
        const ratio = distance(pts[0], pts[1]) / state.pinchDistance;
        state.scale = state.pinchScale * ratio;
        applyZoom();
      }
    });

    const releasePointer = e => {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size < 2) {
        state.pinchDistance = 0;
      }
    };
    image.addEventListener('pointerup', releasePointer);
    image.addEventListener('pointercancel', releasePointer);
    image.addEventListener('pointerleave', e => {
      if (state.pointers.size < 2) releasePointer(e);
    });

    image.addEventListener('wheel', e => {
      e.preventDefault();
      state.scale += e.deltaY < 0 ? 0.25 : -0.25;
      applyZoom();
    }, { passive: false });

    dialog.addEventListener('close', () => {
      state.scale = 1;
      state.pointers.clear();
      state.pinchDistance = 0;
      image.style.transform = 'translate3d(0, 0, 0) scale(1)';
    });
  }

  const image = dialog.querySelector('.photo-viewer-image');
  image.src = url;

  document.documentElement.classList.add('photo-viewer-open');
  document.body.classList.add('photo-viewer-open');

  if (!dialog.dataset.lockWired) {
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('photo-viewer-open');
      document.body.classList.remove('photo-viewer-open');
    });
    dialog.dataset.lockWired = '1';
  }

  if (!dialog.open) {
    dialog.showModal();
  }
}


// ============================================================
// DELETE HANDOVER
// ============================================================

$('#delete').onclick =
  async () => {

    if (!editing) {
      return;
    }


    if (
      !confirm(
        'Delete this handover record?'
      )
    ) {

      return;

    }


    try {

      if (
        Array.isArray(
          editing.photos
        )
      ) {

        for (
          const url
          of editing.photos
        ) {

          await deletePhoto(
            url
          );

        }

      }


      const {
        error
      } =
        await supabaseClient
          .from('handovers_test')
          .delete()
          .eq(
            'id',
            editing.id
          );


      if (error) {
        throw error;
      }


      unlockFormDialogBackground();
    dlg.close();


      await loadRecords();


    } catch (error) {

      console.error(
        'Delete error:',
        error
      );


      alert(
        'There was a problem deleting the handover.'
      );

    }

  };


// ============================================================
// DELETE PHOTO
// ============================================================

async function deletePhoto(
  url
) {

  try {

    const marker =
      `/object/public/${PHOTO_BUCKET}/`;


    const index =
      url.indexOf(
        marker
      );


    if (
      index === -1
    ) {

      return;

    }


    const path =
      decodeURIComponent(
        url.substring(
          index +
          marker.length
        )
      );


    await supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .remove(
        [path]
      );


  } catch (error) {

    console.error(
      'Photo delete error:',
      error
    );

  }

}


// ============================================================
// FILTERS
// ============================================================

document
  .querySelectorAll(
    '[data-filter]'
  )
  .forEach(
    button => {

      button.onclick =
        () => {

          filter =
            button.dataset.filter;


          document
            .querySelectorAll(
              '[data-filter]'
            )
            .forEach(
              x => {

                x.classList.toggle(
                  'active',
                  x === button
                );

              }
            );


          render();

        };

    }
  );


// ============================================================
// SEARCH
// ============================================================

$('#search').oninput =
  render;


// ============================================================
// SIGNATURE PAD
// ============================================================

function setupSignature(
  canvas
) {

  if (!canvas) {
    return;
  }


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.lineWidth =
    2;


  ctx.lineCap =
    'round';


  ctx.lineJoin =
    'round';


  let drawing =
    false;

  let signatureActive =
    false;


  function setActive(active) {
    signatureActive = active;
    canvas.classList.toggle(
      'signature-active',
      active
    );
  }


  function activate() {
    // A deliberate click/tap activates drawing.
    setActive(true);
  }


  // Allow the form-opening/clearing code to fully deactivate this pad.
  canvas.deactivateSignature = () => {
    drawing = false;
    setActive(false);
  };


  function position(e) {

    const rect =
      canvas.getBoundingClientRect();


    const source =
      e.touches
        ? e.touches[0]
        : e;


    return {

      x:
        (
          source.clientX -
          rect.left
        ) *
        (
          canvas.width /
          rect.width
        ),


      y:
        (
          source.clientY -
          rect.top
        ) *
        (
          canvas.height /
          rect.height
        )

    };

  }


  function start(e) {

    // Inactive pads never draw. A click/tap must activate the pad first.
    if (!signatureActive) {
      return;
    }


    e.preventDefault();


    drawing =
      true;


    const p =
      position(e);


    ctx.beginPath();


    ctx.moveTo(
      p.x,
      p.y
    );

  }


  function move(e) {

    if (!drawing || !signatureActive) {
      return;
    }


    e.preventDefault();


    const p =
      position(e);


    ctx.lineTo(
      p.x,
      p.y
    );


    ctx.stroke();

  }


  function stop(e) {

    if (!drawing) {
      return;
    }


    e.preventDefault();


    drawing =
      false;


    ctx.closePath();

  }


  canvas.addEventListener(
    'click',
    activate
  );


  document.addEventListener(
    'click',
    (e) => {
      if (!canvas.contains(e.target)) {
        canvas.deactivateSignature();
      }
    }
  );


  canvas.addEventListener(
    'mousedown',
    start
  );


  canvas.addEventListener(
    'mousemove',
    move
  );


  canvas.addEventListener(
    'mouseup',
    stop
  );


  canvas.addEventListener(
    'mouseleave',
    stop
  );


  canvas.addEventListener(
    'touchstart',
    start,
    {
      passive:
        false
    }
  );


  canvas.addEventListener(
    'touchmove',
    move,
    {
      passive:
        false
    }
  );


  canvas.addEventListener(
    'touchend',
    stop,
    {
      passive:
        false
    }
  );

}


// ============================================================
// CLEAR SIGNATURE
// ============================================================

function clearSignature(
  canvas
) {

  if (!canvas) {
    return;
  }


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (canvas.deactivateSignature) {
    canvas.deactivateSignature();
  }

}


// ============================================================
// RESTORE SIGNATURE
// ============================================================

function drawSavedSignature(
  canvas,
  dataUrl
) {

  if (!canvas || !dataUrl) {
    if (canvas) canvas._signatureReady = Promise.resolve();
    return Promise.resolve();
  }

  const ctx = canvas.getContext('2d');

  const ready = new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };

    img.onerror = reject;
    img.src = dataUrl;
  });

  canvas._signatureReady = ready;
  return ready;
}


// ============================================================
// INITIALISE SIGNATURES
// ============================================================

setupSignature(
  $('#contractorSignature')
);


setupSignature(
  $('#dgslSignature')
);


// ============================================================
// CLEAR SIGNATURE BUTTONS
// ============================================================

$('#clearContractorSignature')
  .onclick =
    () =>
      clearSignature(
        $('#contractorSignature')
      );


$('#clearDgslSignature')
  .onclick =
    () =>
      clearSignature(
        $('#dgslSignature')
      );


// ============================================================
// EXPORT BACKUP
// ============================================================

$('#export').onclick =
  () => {

    const link =
      document.createElement(
        'a'
      );


    link.href =
      URL.createObjectURL(

        new Blob(

          [
            JSON.stringify(
              records,
              null,
              2
            )
          ],

          {
            type:
              'application/json'
          }

        )

      );


    link.download =
      `DGSL-site-register-${today()}` +
      `.json`;


    link.click();


    URL.revokeObjectURL(
      link.href
    );

  };


// ============================================================
// IMPORT BACKUP
// ============================================================

$('#import').onchange =
  async e => {

    const file =
      e.target.files[0];


    if (!file) {
      return;
    }


    const reader =
      new FileReader();


    reader.onload =
      async () => {

        try {

          const imported =
            JSON.parse(
              reader.result
            );


          if (
            !Array.isArray(
              imported
            )
          ) {

            throw new Error(
              'Invalid backup'
            );

          }


          for (
            const record
            of imported
          ) {

            const databaseRecord =
              toDatabase(
                record
              );


            const {
              error
            } =
              await supabaseClient
                .from('handovers_test')
                .upsert(
                  databaseRecord
                );


            if (error) {
              throw error;
            }

          }


          await loadRecords();


          alert(
            'Backup imported.'
          );


        } catch (error) {

          console.error(
            error
          );


          alert(
            'That file is not a valid DGSL backup.'
          );

        }

      };


    reader.readAsText(
      file
    );

  };


// ============================================================
// GENERATE PDF
// ============================================================

$('#generatePdf').onclick =
  async () => {

    await generatePdf();

  };


async function generatePdf(viewOnly = false) {

  try {

    const {
      jsPDF
    } =
      window.jspdf;


    const pdf =
      new jsPDF({

        orientation:
          'portrait',

        unit:
          'mm',

        format:
          'a4'

      });


    const margin =
      15;


    const pageWidth =
      210;


    let y =
      20;


    const logoData =
      await loadLogoForPdf();


    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    pdf.setFontSize(
      20
    );


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'DGSL SITE HANDOVER',
      margin,
      y
    );


    // Correct logo proportions
    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }


    y += 8;


    pdf.setFontSize(
      14
    );


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'Knocksedan, PH3',
      margin,
      y
    );


    y += 10;


    pdf.line(
      margin,
      y,
      pageWidth - margin,
      y
    );




    await Promise.all([
      $('#contractorSignature')?._signatureReady,
      $('#dgslSignature')?._signatureReady
    ].filter(Boolean));

    const data = {
  zone: form.elements.zone?.value || '',
  contractor: form.elements.contractor?.value || '',
  drawing: form.elements.drawing?.value || '',
  level:
  form.elements.level?.value === 'Other'
    ? document.getElementById('levelOther').value || 'Other'
    : form.elements.level?.value || '',

trade:
  form.elements.trade?.value === 'Other'
    ? document.getElementById('tradeOther').value || 'Other'
    : form.elements.trade?.value || '',

foreman:
  form.elements.foreman?.value === 'Other'
    ? document.getElementById('foremanOther').value || 'Other'
    : form.elements.foreman?.value || '',

healthSafetyScaffolding:
  form.elements.healthSafetyScaffolding?.value === 'Other'
    ? document.getElementById('healthSafetyScaffoldingOther').value || 'Other'
    : form.elements.healthSafetyScaffolding?.value || '',
  description: form.elements.description?.value || '',
  status:
  form.elements.status?.value === 'Other'
    ? document.getElementById('statusOther').value || 'Other'
    : form.elements.status?.value || '',
  handoverDate: form.elements.handoverDate?.value || '',
  takeBackDate: form.elements.takeBackDate?.value || '',
  takeBackCompleteDrawings:
  form.elements.takeBackCompleteDrawings?.value === 'Other'
    ? document.getElementById('takeBackCompleteDrawingsOther').value || 'Other'
    : form.elements.takeBackCompleteDrawings?.value || '',
  takeBackHousekeeping:
  form.elements.takeBackHousekeeping?.value === 'Other'
    ? document.getElementById('takeBackHousekeepingOther').value || 'Other'
    : form.elements.takeBackHousekeeping?.value || '',
  takeBackSnagCompleted:
  form.elements.takeBackSnagCompleted?.value === 'Other'
    ? document.getElementById('takeBackSnagCompletedOther').value || 'Other'
    : form.elements.takeBackSnagCompleted?.value || '',
  notes: form.elements.notes?.value || '',
  contractorSigner:
    form.elements.contractorSigner?.value || '',
  dgslSigner:
    form.elements.dgslSigner?.value || ''
};


    // STATUS BUBBLE — top right, directly beneath the header line.
    const statusColors = {
      'Work Permit Open': [246, 196, 83],
      'Work Permit Closed': [122, 203, 138],
      'Work Permit on Hold': [239, 119, 119]
    };

    const statusColor =
      statusColors[data.status] || [217, 222, 227];

    const statusBubbleX = 145;
    const statusBubbleY = y + 3;
    const statusBubbleWidth = 50;
    const statusBubbleHeight = 9;

    pdf.setFillColor(
      statusColor[0],
      statusColor[1],
      statusColor[2]
    );

    pdf.roundedRect(
      statusBubbleX,
      statusBubbleY,
      statusBubbleWidth,
      statusBubbleHeight,
      3,
      3,
      'F'
    );

    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(34, 34, 34);

    const statusText = data.status || '';
    const statusTextLines =
      pdf.splitTextToSize(
        statusText,
        statusBubbleWidth - 6
      );

    const statusTextY =
      statusBubbleY +
      statusBubbleHeight / 2 +
      (statusTextLines.length === 1 ? 1.1 : 0);

    pdf.text(
      statusTextLines,
      statusBubbleX + statusBubbleWidth / 2,
      statusTextY,
      { align: 'center' }
    );

    pdf.setTextColor(0, 0, 0);


    y += 8;

    // --------------------------------------------------------
    // PDF FIELD
    // Fixed label/value columns so text cannot overlap.
    // --------------------------------------------------------

    function addField(
      label,
      value
    ) {

      pdf.setFontSize(
        10
      );


      // Dedicated space for the label.
      const labelWidth =
        55;


      // Value starts after the label area.
      const valueX =
        margin + 60;


      // Remaining page width for the value.
      const valueWidth =
        pageWidth -
        margin -
        valueX;


      // Wrap long labels.
      const labelLines =
        pdf.splitTextToSize(
          `${label}:`,
          labelWidth
        );


      // Wrap long values.
      const valueLines =
        pdf.splitTextToSize(
          value || '',
          valueWidth
        );


      // Label
      pdf.setFont(
        undefined,
        'bold'
      );


      pdf.text(
        labelLines,
        margin,
        y
      );


      // Value
      pdf.setFont(
        undefined,
        'normal'
      );


      pdf.text(
        valueLines,
        valueX,
        y
      );


      // Move down far enough for whichever side
      // contains the most lines.
      const lineCount =
        Math.max(
          labelLines.length,
          valueLines.length
        );


      y +=
        Math.max(
          7,
          lineCount * 5
        );

    }


    // --------------------------------------------------------
    // HANDOVER DETAILS
    // --------------------------------------------------------

    addField(
      'Zone / Area',
      data.zone
    );


    addField(
      'Sub Contractor / Company Name',
      data.contractor
    );


    addField(
      'Drawing / Reference',
      data.drawing
    );


    // Show "Outstanding" in red in the PDF.
    if (String(data.level || '').trim().toLowerCase() === 'outstanding') {
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text('Safety Documents:', margin, y);
      pdf.setTextColor(211, 47, 47);
      pdf.setFont(undefined, 'normal');
      pdf.text('Outstanding', margin + 60, y);
      pdf.setTextColor(0, 0, 0);
      y += 7;
    } else {
      addField(
        'Safety Documents',
        data.level
      );
    }


    addField(
      'Housekeeping at time of Take Over',
      data.trade
    );


    addField(
      'Materials Checks',
      data.foreman
    );


    addField(
      'Health & Safety - Scaffolding / Handrails',
      data.healthSafetyScaffolding
    );


    addField(
      'Work Description',
      data.description
    );


    addField(
      'Handover Date',
      formatDate(data.handoverDate)
    );


    // --------------------------------------------------------
    // CHECKLIST
    // --------------------------------------------------------

    y += 5;


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.setFontSize(
      12
    );


    pdf.text(
      'Checklist',
      margin,
      y
    );


    y += 7;


    pdf.setFontSize(
      10
    );


    pdf.setFont(
      undefined,
      'normal'
    );


    const checklistItems = [

      'Current approved drawings, specification, RFI responses, setting-out data and revisions available at workface.',

      'Task-specific RAMS briefed; workers inducted; Safe Pass / CSCS / trade competence checked as applicable.',

      'Work area, access, lighting, scaffold / edge protection, temporary works, previous trade and substrate accepted',

      'Materials / products approved and traceable; plant, tools and test equipment inspected / certified / calibrated.',

      'Interfaces with adjacent trades, services, deliveries, exclusion zones and shared access agreed.',

      'Protection of completed work plus weather, water, dust, noise and environmental controls agreed.',

      'Hold / Witness Points, first-off, photos, tests and QA records identified; emergency, waste, housekeeping and security controls agreed.'

    ];


    const checklist =
      getTakeBackChecklist();


    checklistItems.forEach(
      (item, index) => {

        if (
          y > 265
        ) {

          pdf.addPage();

          y =
            20;


          if (logoData) {

            pdf.addImage(
              logoData,
              'PNG',
              140,
              10,
              55,
              11.1
            );

          }

        }


        const itemNumber =
          index + 1;


        const answer =
          checklist[itemNumber] ||
          'yes';


        const lines =
          pdf.splitTextToSize(
            `${itemNumber}. ${item}`,
            145
          );


        pdf.text(
          lines,
          margin,
          y
        );


        pdf.setFont(
          undefined,
          'bold'
        );


        pdf.text(
          'Yes',
          165,
          y
        );


        pdf.text(
          'No',
          185,
          y
        );


        pdf.setFont(
          undefined,
          'normal'
        );


        const boxY =
          y - 3;


        pdf.rect(
          160,
          boxY,
          4,
          4
        );


        pdf.rect(
          180,
          boxY,
          4,
          4
        );


        if (
          answer === 'yes'
        ) {

          pdf.setFont(
            undefined,
            'bold'
          );


          pdf.text(
            'X',
            161,
            y
          );


          pdf.setFont(
            undefined,
            'normal'
          );

        }


        if (
          answer === 'no'
        ) {

          pdf.setFont(
            undefined,
            'bold'
          );


          pdf.text(
            'X',
            181,
            y
          );


          pdf.setFont(
            undefined,
            'normal'
          );

        }


        y +=
          Math.max(
            8,
            lines.length * 5
          ) +
          2;

      }
    );


    // --------------------------------------------------------
    // PAGE 2: DGSL TAKE BACK DETAILS
    // --------------------------------------------------------

    // Keep the Take Back section on page 2.
    pdf.addPage();

    y = 20;

    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }

    pdf.setFont(
      undefined,
      'bold'
    );

    pdf.setFontSize(
      12
    );

    pdf.text(
      'DGSL Take Back Details',
      margin,
      y
    );

    y += 7;

    pdf.setFontSize(
      10
    );

    addField(
      'Take Back Date',
      formatDate(data.takeBackDate)
    );

    addField(
      'All works complete to drawings',
      data.takeBackCompleteDrawings
    );

    addField(
      'Housekeeping at time of Take Back',
      data.takeBackHousekeeping
    );

    addField(
      'DG to Snag completed works',
      data.takeBackSnagCompleted
    );

    // --------------------------------------------------------
    // NOTES
    // --------------------------------------------------------

    y += 2;

    pdf.setFont(
      undefined,
      'bold'
    );

    pdf.text(
      'Notes / Outstanding Items',
      margin,
      y
    );

    y += 6;

    pdf.setFont(
      undefined,
      'normal'
    );

    const noteLines =
      pdf.splitTextToSize(
        data.notes || '',
        pageWidth -
          margin * 2
      );

    pdf.text(
      noteLines,
      margin,
      y
    );

    y +=
      Math.max(
        12,
        noteLines.length * 5
      );

    // --------------------------------------------------------
    // SIGNATURES
    // --------------------------------------------------------

    y += 2;

    pdf.setFont(
      undefined,
      'bold'
    );

    pdf.text(
      'Signatures',
      margin,
      y
    );

    y += 7;

    pdf.setFont(
      undefined,
      'normal'
    );

    pdf.text(
      `Sub-Contractor Name: ${
        data.contractorSigner || ''
      }`,
      margin,
      y
    );

    y += 5;

    pdf.addImage(
      $('#contractorSignature')
        .toDataURL(
          'image/png'
        ),
      'PNG',
      margin,
      y,
      65,
      20
    );

    y += 26;

    pdf.text(
      `DGSL Representative: ${
        data.dgslSigner || ''
      }`,
      margin,
      y
    );

    y += 5;

    pdf.addImage(
      $('#dgslSignature')
        .toDataURL(
          'image/png'
        ),
      'PNG',
      margin,
      y,
      65,
      20
    );

    y += 25;

    // --------------------------------------------------------
    // SITE PHOTOS
    // Photos are placed immediately below the DGSL
    // Representative signature and arranged two per row
    // to help keep the document to two pages.
    // --------------------------------------------------------

    const photoUrls =
      editing?.photos || [];

    if (
      photoUrls.length > 0
    ) {

      pdf.setFontSize(
        12
      );

      pdf.setFont(
        undefined,
        'bold'
      );

      pdf.text(
        'SITE PHOTOS',
        margin,
        y
      );

      y += 6;

      const photoMaxWidth = 78;
      const photoMaxHeight = 42;
      const photoGap = 4;
      const secondPhotoX = margin + photoMaxWidth + photoGap;

      let photoRowY = y;
      let photoColumn = 0;
      let rowHeight = 0;

      for (
        const url
        of photoUrls
      ) {

        try {

          const imageData =
            await loadImageForPdf(
              url
            );

          const dimensions =
            await getImageDimensions(
              imageData
            );

          let width = photoMaxWidth;
          let height =
            (dimensions.height / dimensions.width) * width;

          if (height > photoMaxHeight) {
            height = photoMaxHeight;
            width =
              (dimensions.width / dimensions.height) * height;
          }

          // If the photos cannot fit on page 2, start a new page.
          // This keeps the layout compact while avoiding clipped photos.
          if (
            photoRowY + height > 285
          ) {

            pdf.addPage();

            photoRowY = 20;
            photoColumn = 0;
            rowHeight = 0;

            if (logoData) {

              pdf.addImage(
                logoData,
                'PNG',
                140,
                10,
                55,
                11.1
              );

            }

          }

          const photoX =
            photoColumn === 0
              ? margin
              : secondPhotoX;

          pdf.addImage(
            imageData,
            'JPEG',
            photoX,
            photoRowY,
            width,
            height
          );

          rowHeight =
            Math.max(
              rowHeight,
              height
            );

          if (photoColumn === 0) {

            photoColumn = 1;

          } else {

            photoColumn = 0;
            photoRowY += rowHeight + 5;
            rowHeight = 0;

          }

        } catch (error) {

          console.error(
            'Could not add photo to PDF:',
            error
          );

        }

      }

    }

    // --------------------------------------------------------
    // SAVE PDF
    // --------------------------------------------------------

    const safeZone =
      (
        data.zone ||
        'Handover'
      )
        .replace(
          /[^a-z0-9-_ ]/gi,
          ''
        )
        .replace(
          /\s+/g,
          '-'
        );


    if (viewOnly) {
      return pdf.output('blob');
    } else {
      pdf.save(
        `DGSL-${safeZone}-Handover-${today()}.pdf`
      );
    }


  } catch (error) {

    console.error(
      'PDF error:',
      error
    );


    alert(
      'There was a problem creating the PDF.\n\n' +
      error.message
    );

  }

}


// ============================================================
// LOAD LOGO FOR PDF
// ============================================================

function loadLogoForPdf() {

  return new Promise(
    resolve => {

      const img =
        new Image();


      img.onload =
        () => {

          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            img.naturalWidth;


          canvas.height =
            img.naturalHeight;


          const ctx =
            canvas.getContext(
              '2d'
            );


          ctx.drawImage(
            img,
            0,
            0
          );


          resolve(
            canvas.toDataURL(
              'image/png'
            )
          );

        };


      img.onerror =
        () => {

          console.error(
            `Could not load ${LOGO_FILE}`
          );


          resolve(
            null
          );

        };


      img.src =
        LOGO_FILE;

    }
  );

}


// ============================================================
// LOAD IMAGE FOR PDF
// ============================================================

function loadImageForPdf(
  url
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const img =
        new Image();


      img.crossOrigin =
        'anonymous';


      img.onload =
        () => {

          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            img.naturalWidth;


          canvas.height =
            img.naturalHeight;


          const ctx =
            canvas.getContext(
              '2d'
            );


          ctx.drawImage(
            img,
            0,
            0
          );


          resolve(
            canvas.toDataURL(
              'image/jpeg',
              0.85
            )
          );

        };


      img.onerror =
        reject;


      img.src =
        url;

    }
  );

}


// ============================================================
// ADD IMAGE TO PDF
// ============================================================

async function addImageToPdf(
  pdf,
  imageData,
  y,
  margin
) {

  if (
    y > 260
  ) {

    pdf.addPage();


    y =
      20;


    const logoData =
      await loadLogoForPdf();


    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }

  }


  const dimensions =
    await getImageDimensions(
      imageData
    );


  const maxWidth =
    80;


  const maxHeight =
    65;


  let width =
    maxWidth;


  let height =
    (
      dimensions.height /
      dimensions.width
    ) *
    width;


  if (
    height >
    maxHeight
  ) {

    height =
      maxHeight;


    width =
      (
        dimensions.width /
        dimensions.height
      ) *
      height;

  }


  if (
    y + height >
    280
  ) {

    pdf.addPage();


    y =
      20;


    const logoData =
      await loadLogoForPdf();


    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }

  }


  pdf.addImage(
    imageData,
    'JPEG',
    margin,
    y,
    width,
    height
  );


  return y +
    height +
    8;

}


// ============================================================
// IMAGE DIMENSIONS
// ============================================================

function getImageDimensions(
  src
) {

  return new Promise(
    resolve => {

      const img =
        new Image();


      img.onload =
        () => {

          resolve({

            width:
              img.width,

            height:
              img.height

          });

        };


      img.src =
        src;

    }
  );

}


// ============================================================
// START APPLICATION
// ============================================================

async function startApp() {

  try {

    addLogoToForm();

    await loadSupabase();

    const { data: sessionData } =
      await supabaseClient.auth.getSession();

    currentUser =
      sessionData?.session?.user || null;

    ensureAuthUi();
    updateAuthUi();

    supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        currentUser =
          session?.user || null;

        updateAuthUi();
        render();
        refreshNotificationState();
      }
    );

    await loadRecords();

    setupRealtime();
    await refreshNotificationState();

  } catch (error) {

    console.error(
      'Startup error:',
      error
    );


    alert(
      'The DGSL Site Register could not connect to Supabase.'
    );

  }

}


startApp();





// Prevent iOS touch scrolling from leaking out of the PDF viewer.
document.addEventListener(
  'touchmove',
  event => {
    if (!document.body.classList.contains('pdf-dialog-open')) return;

    const viewer = document.getElementById('pdfViewer');
    if (viewer && viewer.contains(event.target)) return;

    event.preventDefault();
  },
  { passive: false }
);


// ============================================================
// PDF VIEWER CLOSE
// ============================================================

$('#closePdf').onclick =
  () => {

    const pdfDialog =
      $('#pdfDialog');

    pdfDialog.close();
    unlockPdfDialogBackground();
    document.documentElement.classList.remove('pdf-dialog-open');

    $('#pdfViewer').innerHTML = '';

  };
