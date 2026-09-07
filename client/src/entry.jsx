const isAdmin = window.location.pathname.startsWith('/admin');

if (isAdmin) {
  import('./admin.jsx');
} else {
  import('./lms.jsx').then(() => import('./forumEnhancer.js'));
}
