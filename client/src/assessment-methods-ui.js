const TYPES = ['Direct observation', 'question and answer', 'personal statement', 'work practice'];

function renderAssessmentMethods() {
  const heading = [...document.querySelectorAll('h1')].find(
    el => el.textContent.trim() === 'Assessment Methods'
  );
  if (!heading) return;

  const page = heading.parentElement;
  if (!page || page.dataset.assessmentMethodsReady === 'true') return;

  page.dataset.assessmentMethodsReady = 'true';
  page.innerHTML = `
    <h1 class="page-title">Assessment Methods</h1>
    <p class="muted">Choose an assessment method to make it available to students.</p>
    <div class="card">
      <div class="form-group">
        <label>Assessment type</label>
        <select id="assessment-method-type">
          ${TYPES.map((type, index) => `
            <option value="${type}"${index === 0 ? ' selected' : ''}>${type}</option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

const observer = new MutationObserver(renderAssessmentMethods);
observer.observe(document.body, { childList: true, subtree: true });
renderAssessmentMethods();
