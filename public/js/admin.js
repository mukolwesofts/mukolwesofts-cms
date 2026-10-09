// Admin console: login, project CRUD + reorder, profile editor.
// All mutating requests send X-Requested-With: fetch (CSRF header check).

const $ = (id) => document.getElementById(id);

async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'fetch',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        /* non-JSON response */
    }
    if (!res.ok) {
        throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
}

function setMsg(el, text, ok) {
    el.textContent = text || '';
    el.className = 'msg ' + (ok ? 'msg-ok' : 'msg-err');
    if (!text) el.className = 'msg';
}

/* ---------------- views ---------------- */

function showLogin() {
    $('login-view').hidden = false;
    $('dashboard-view').hidden = true;
    $('logout-btn').hidden = true;
}

function showDashboard() {
    $('login-view').hidden = true;
    $('dashboard-view').hidden = false;
    $('logout-btn').hidden = false;
}

/* ---------------- login ---------------- */

$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('login-msg');
    setMsg(msg, '');
    try {
        await api('/api/admin/login', {
            method: 'POST',
            body: { password: $('login-password').value },
        });
        $('login-password').value = '';
        await enterDashboard();
    } catch (err) {
        setMsg(msg, err.message, false);
    }
});

$('logout-btn').addEventListener('click', async () => {
    try {
        await api('/api/admin/logout', { method: 'POST' });
    } finally {
        showLogin();
    }
});

/* ---------------- projects ---------------- */

let projects = [];

function tagsToArray(text) {
    return text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
}

function resetProjectForm() {
    $('project-id').value = '';
    $('project-form').reset();
    $('project-form-cmd').textContent = './new-project';
    $('project-submit').textContent = 'Save project';
    $('project-cancel').hidden = true;
}

function fillProjectForm(p) {
    $('project-id').value = p.id;
    $('project-name').value = p.name;
    $('project-tags').value = (p.tags || []).join(', ');
    $('project-description').value = p.description;
    $('project-github').value = p.github_url;
    $('project-live').value = p.live_url;
    $('project-featured').checked = !!p.featured;
    $('project-form-window').open = true;
    $('project-form-cmd').textContent = `./edit-project ${p.slug}`;
    $('project-submit').textContent = 'Save changes';
    $('project-cancel').hidden = false;
    $('project-name').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('project-cancel').addEventListener('click', resetProjectForm);

$('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('project-msg');
    setMsg(msg, '');
    const id = $('project-id').value;
    const body = {
        name: $('project-name').value,
        tags: tagsToArray($('project-tags').value),
        description: $('project-description').value,
        github_url: $('project-github').value,
        live_url: $('project-live').value,
        featured: $('project-featured').checked,
    };
    try {
        if (id) {
            await api(`/api/projects/${id}`, { method: 'PUT', body });
            setMsg(msg, 'Changes saved.', true);
        } else {
            await api('/api/projects', { method: 'POST', body });
            setMsg(msg, 'Project created.', true);
        }
        resetProjectForm();
        await loadProjects();
    } catch (err) {
        setMsg(msg, err.message, false);
    }
});

async function loadProjects() {
    projects = await api('/api/projects');
    renderProjectList();
}

function renderProjectList() {
    const list = $('admin-project-list');
    list.textContent = '';
    $('admin-projects-empty').hidden = projects.length > 0;

    projects.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'admin-project';

        const name = document.createElement('span');
        name.className = 'admin-project-name';
        name.textContent = `${i + 1}. ${p.name}${p.featured ? ' ★' : ''}`;
        li.appendChild(name);

        const actions = document.createElement('span');
        actions.className = 'admin-project-actions';

        const up = document.createElement('button');
        up.className = 'btn btn-sm';
        up.type = 'button';
        up.textContent = 'up';
        up.disabled = i === 0;
        up.addEventListener('click', () => moveProject(i, -1));

        const down = document.createElement('button');
        down.className = 'btn btn-sm';
        down.type = 'button';
        down.textContent = 'down';
        down.disabled = i === projects.length - 1;
        down.addEventListener('click', () => moveProject(i, 1));

        const edit = document.createElement('button');
        edit.className = 'btn btn-sm';
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => fillProjectForm(p));

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.type = 'button';
        del.textContent = 'Delete project';
        del.addEventListener('click', () => deleteProject(p));

        actions.append(up, down, edit, del);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

async function moveProject(index, dir) {
    const ids = projects.map((p) => p.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const msg = $('list-msg');
    setMsg(msg, '');
    try {
        await api('/api/projects/reorder', { method: 'PUT', body: { ids } });
        await loadProjects();
    } catch (err) {
        setMsg(msg, err.message, false);
    }
}

async function deleteProject(p) {
    if (!window.confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    const msg = $('list-msg');
    setMsg(msg, '');
    try {
        await api(`/api/projects/${p.id}`, { method: 'DELETE' });
        setMsg(msg, `Deleted ${p.name}.`, true);
        if ($('project-id').value === String(p.id)) resetProjectForm();
        await loadProjects();
    } catch (err) {
        setMsg(msg, err.message, false);
    }
}

/* ---------------- profile ---------------- */

const PROFILE_FIELDS = [
    'headline',
    'about_text',
    'role',
    'stack',
    'location',
    'status',
    'email',
    'whatsapp',
    'github_url',
    'github_org_url',
];

async function loadProfile() {
    const profile = await api('/api/profile');
    for (const f of PROFILE_FIELDS) {
        $(`profile-${f === 'about_text' ? 'about' : f}`).value = profile[f] || '';
    }
}

$('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('profile-msg');
    setMsg(msg, '');
    const body = {};
    for (const f of PROFILE_FIELDS) {
        body[f] = $(`profile-${f === 'about_text' ? 'about' : f}`).value;
    }
    try {
        await api('/api/profile', { method: 'PUT', body });
        setMsg(msg, 'Changes saved.', true);
    } catch (err) {
        setMsg(msg, err.message, false);
    }
});

/* ---------------- change password ---------------- */

const pwStrength = $('pw-strength');

$('pw-new').addEventListener('input', (e) => {
    const v = e.target.value;
    pwStrength.textContent = '';
    pwStrength.className = 'pw-strength';
    if (!v) return;

    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;

    const level = score <= 2 ? 'weak' : score <= 4 ? 'fair' : 'strong';
    pwStrength.classList.add(`strength-${level}`);

    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.textContent = '█'.repeat(score) + '░'.repeat(5 - score);
    const label = document.createElement('span');
    label.className = 'level';
    label.textContent = ` ${level}`;
    pwStrength.append('strength: [', bar, ']', label);
});

$('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('password-msg');
    setMsg(msg, '');
    const current = $('pw-current').value;
    const next = $('pw-new').value;
    if (next !== $('pw-confirm').value) {
        setMsg(msg, 'New passwords do not match.', false);
        return;
    }
    try {
        await api('/api/admin/password', {
            method: 'POST',
            body: { current_password: current, new_password: next },
        });
        setMsg(msg, 'Password changed.', true);
        e.target.reset();
        pwStrength.textContent = '';
        pwStrength.className = 'pw-strength';
    } catch (err) {
        setMsg(msg, err.message, false);
    }
});

/* ---------------- init ---------------- */

async function enterDashboard() {
    showDashboard();
    resetProjectForm();
    await Promise.all([loadProjects(), loadProfile()]);
}

(async function init() {
    try {
        await api('/api/admin/me');
        await enterDashboard();
    } catch (e) {
        showLogin();
    }
})();
