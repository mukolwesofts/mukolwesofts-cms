// 404 page: echo the path the visitor actually tried to reach
(function () {
    const path = window.location.pathname + window.location.search;
    document.getElementById('bad-path').textContent = path;
    document.getElementById('bad-path-echo').textContent = path;
})();
