// Public site: fetches profile + projects and renders them.
// Everything goes through textContent — never innerHTML with user data.

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function externalLink(href, label) {
    const a = el('a', null, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
}

function renderProfile(profile) {
    setText('hero-intro', profile.headline);
    setText('profile-role', profile.role);
    setText('profile-stack', profile.stack);
    setText('profile-location', profile.location);
    setText('profile-status', profile.status);
    setText('profile-about', profile.about_text);

    const email = document.getElementById('contact-email');
    email.textContent = '';
    if (profile.email) {
        const a = el('a', null, profile.email);
        a.href = `mailto:${profile.email}`;
        email.appendChild(a);
    } else {
        email.textContent = '—';
    }

    const whatsapp = document.getElementById('contact-whatsapp');
    whatsapp.textContent = '';
    if (profile.whatsapp) {
        const url = `https://wa.me/${profile.whatsapp.replace(/[^0-9]/g, '')}`;
        const a = el('a', null, url);
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        whatsapp.appendChild(a);
    } else {
        whatsapp.textContent = '—';
    }

    const github = document.getElementById('contact-github');
    github.textContent = '';
    if (profile.github_url) {
        github.appendChild(externalLink(profile.github_url, profile.github_url));
    } else {
        github.textContent = '—';
    }

    const githubOrg = document.getElementById('contact-github-org');
    githubOrg.textContent = '';
    if (profile.github_org_url) {
        githubOrg.appendChild(externalLink(profile.github_org_url, profile.github_org_url));
    } else {
        githubOrg.textContent = '—';
    }
}

function renderProjects(projects) {
    const list = document.getElementById('project-list');
    const empty = document.getElementById('projects-empty');
    list.textContent = '';

    if (!projects.length) {
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    for (const p of projects) {
        const li = el('li', 'project');

        const name = el('div', 'project-name', p.name);
        if (p.featured) name.appendChild(el('span', 'project-featured', '★ featured'));
        li.appendChild(name);

        li.appendChild(el('p', 'project-desc', p.description));

        const meta = el('div', 'project-meta');

        if (p.tags && p.tags.length) {
            const tags = el('span', 'tags');
            for (const t of p.tags) tags.appendChild(el('span', 'tag', t));
            meta.appendChild(tags);
        }

        if (p.github_url || p.live_url) {
            const links = el('span', 'project-links');
            if (p.github_url) links.appendChild(externalLink(p.github_url, 'github'));
            if (p.live_url) links.appendChild(externalLink(p.live_url, 'live'));
            meta.appendChild(links);
        }

        li.appendChild(meta);
        list.appendChild(li);
    }
}

async function maybeShowAdminLink() {
    try {
        const res = await fetch('/api/admin/me');
        if (!res.ok) return;
        const nav = document.querySelector('.site-nav');
        const a = document.createElement('a');
        a.href = '/admin';
        a.textContent = 'admin';
        nav.appendChild(a);
    } catch (e) {
        /* not logged in — stay quiet */
    }
}

(async function init() {
    maybeShowAdminLink();
    try {
        const [profile, projects] = await Promise.all([
            getJSON('/api/profile'),
            getJSON('/api/projects'),
        ]);
        renderProfile(profile);
        renderProjects(projects);
    } catch (err) {
        console.error(err);
        setText('hero-intro', 'something went wrong — try reloading.');
    }
})();
