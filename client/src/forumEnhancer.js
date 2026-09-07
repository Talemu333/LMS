import React from 'react';
import { createRoot } from 'react-dom/client';
import ForumPage from './components/ForumPage.jsx';

let mountedElement = null;
let root = null;

function syncForum() {
  const main = document.querySelector('main.main');
  if (!main) return;
  const title = main.querySelector('.page-title');
  const isForum = title?.textContent?.trim() === 'Forum';

  if (!isForum) {
    if (root) {
      root.unmount();
      root = null;
      mountedElement = null;
    }
    return;
  }

  if (root && mountedElement?.isConnected) return;

  const existingSection = [...main.querySelectorAll('.section')].find(section => section.querySelector('.empty'));
  if (!existingSection) return;

  const roleText = main.querySelector('.page-role')?.textContent || '';
  const role = roleText.includes('Instructor') ? 'instructor' : 'student';
  const mount = document.createElement('div');
  mount.className = 'forum-enhanced-root';
  existingSection.replaceWith(mount);
  mountedElement = mount;
  root = createRoot(mount);
  root.render(React.createElement(ForumPage, { role }));
}

const observer = new MutationObserver(syncForum);
observer.observe(document.body, { childList: true, subtree: true });
syncForum();
