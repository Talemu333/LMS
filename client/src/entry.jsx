const isAdmin = window.location.pathname.startsWith('/admin');

if (isAdmin) {
  import('./admin.jsx');
} else {
  import('./lms.jsx').then(() => Promise.all([import('./forumEnhancer.js'), import('./instructorEnhancer.js'), import('./studentEnhancer.jsx')]));
}
