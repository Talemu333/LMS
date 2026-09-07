const isAdmin = window.location.pathname.startsWith('/admin');

if (isAdmin) {
  import('./admin-clean.jsx');
} else {
  import('./lms.jsx');
}
