import React from 'react';
import { createRoot } from 'react-dom/client';
import ForumPage from './components/ForumPage.jsx';

let root = null;
let mount = null;
let active = false;

function syncForum() {
  const main = document.querySelector('main.main');
  if (!main) return;

  const title = main.querySelector('.page-title')?.textContent?.trim() || '';
  const isForum = title === 'Forum';

  if (!isForum) {
    if (root) {
      root.unmount();
      root = null;
      mount = null;
    }
    active = false;
    return;
  }

  if (root && mount?.isConnected && active) return;

  const placeholder = [...main.querySelectorAll('.section')]
    .find(section => section.querySelector('.empty'));

  if (!placeholder) return;

  if (root) root.unmount();

  mount = document.createElement('div');
  mount.className = 'forum-enhanced-root';
  placeholder.replaceWith(mount);
  active = true;
  root = createRoot(mount);

  const roleText = main.querySelector('.page-role')?.textContent || '';
  const role = roleText.includes('Instructor') ? 'instructor' : 'student';
  root.render(<ForumPage role={role} />);
}

const observer = new MutationObserver(syncForum);
observer.observe(document.body, { childList: true, subtree: true });
syncForum();
