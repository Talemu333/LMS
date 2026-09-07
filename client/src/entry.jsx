const path = window.location.pathname;

if (path === '/admin/setup') {
  import('./admin-setup.jsx');
} else if (path.startsWith('/admin')) {
  import('./admin-clean.jsx');
} else {
  import('./lms.jsx');
}
