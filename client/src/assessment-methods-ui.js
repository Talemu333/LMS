const TYPES = ['Direct observation', 'Question and answer', 'Personal statement', 'Work practice'];
const API = import.meta.env.VITE_API_URL || 'https://eles-lms-api.onrender.com/api';

async function assessmentApi(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to save assessment method.');
  return data;
}

function renderAssessmentMethods() {
  const heading = [...document.querySelectorAll('h1')].find(el => el.textContent.trim() === 'Assessment Methods');
  if (!heading) return;
  const page = heading.parentElement;
  if (!page || page.dataset.assessmentMethodsReady === 'true') return;

  page.dataset.assessmentMethodsReady = 'true';
  page.innerHTML = `
    <h1 class="page-title">Assessment Methods</h1>
    <p class="muted">Choose an assessment method to make it available to students.</p>
    <div class="card">
      <form id="assessment-method-form">
        <div class="form-group">
          <label>Assessment type</label>
          <select id="assessment-method-type">
            ${TYPES.map((type, index) => `<option value="${type}"${index === 0 ? ' selected' : ''}>${type}</option>`).join('')}
          </select>
        </div>
        <div id="assessment-method-error" class="error-box" style="display:none"></div>
        <div id="assessment-method-success" class="success-box" style="display:none"></div>
        <button id="assessment-method-save" class="btn btn-primary" type="submit">Save Assessment Method</button>
      </form>
    </div>
    <section class="section">
      <h2>Saved Assessment Methods</h2>
      <div id="assessment-method-list" class="cards">
        <div class="card empty">Loading assessment methods...</div>
      </div>
    </section>
  `;

  const form = page.querySelector('#assessment-method-form');
  const select = page.querySelector('#assessment-method-type');
  const saveButton = page.querySelector('#assessment-method-save');
  const errorBox = page.querySelector('#assessment-method-error');
  const successBox = page.querySelector('#assessment-method-success');
  const list = page.querySelector('#assessment-method-list');

  const showError = message => {
    errorBox.textContent = message;
    errorBox.style.display = message ? 'block' : 'none';
  };
  const showSuccess = message => {
    successBox.textContent = message;
    successBox.style.display = message ? 'block' : 'none';
  };

  async function load() {
    try {
      const data = await assessmentApi('/instructor/assessments');
      const assessments = data.assessments || [];
      list.innerHTML = assessments.length
        ? assessments.map(a => `
            <div class="card" data-assessment-id="${a.id}">
              <div class="section-head">
                <div>
                  <div class="muted">${a.assessment_type}</div>
                  <h3>${a.title}</h3>
                </div>
                <button class="btn btn-danger" type="button" data-delete-assessment="${a.id}">Remove</button>
              </div>
            </div>
          `).join('')
        : '<div class="card empty">No assessment methods have been added.</div>';
    } catch (error) {
      list.innerHTML = '<div class="card empty">Unable to load assessment methods.</div>';
      showError(error.message);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    showError('');
    showSuccess('');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    try {
      await assessmentApi('/instructor/assessments', {
        method: 'POST',
        body: JSON.stringify({ assessmentType: select.value })
      });
      showSuccess('Assessment method saved.');
      await load();
    } catch (error) {
      showError(error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Assessment Method';
    }
  });

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-delete-assessment]');
    if (!button) return;
    showError('');
    showSuccess('');
    button.disabled = true;
    try {
      await assessmentApi(`/instructor/assessments/${button.dataset.deleteAssessment}`, { method: 'DELETE' });
      showSuccess('Assessment method removed.');
      await load();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });

  load();
}

const observer = new MutationObserver(renderAssessmentMethods);
observer.observe(document.body, { childList: true, subtree: true });
renderAssessmentMethods();
