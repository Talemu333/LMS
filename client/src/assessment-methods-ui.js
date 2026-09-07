const TYPES = ['Direct observation', 'question and answer', 'personal statement', 'work practice'];

function applyAssessmentMethodsView() {
  const heading = [...document.querySelectorAll('h1')].find(
    el => el.textContent.trim() === 'Assessment Methods'
  );
  if (!heading) return;

  const page = heading.parentElement;
  if (!page) return;
  page.classList.add('assessment-methods-clean');

  const groups = [...page.querySelectorAll('.form-group')];
  groups.forEach(group => {
    const label = group.querySelector('label')?.textContent.trim().toLowerCase();
    group.classList.toggle('assessment-type-only', label === 'assessment type');
  });

  page.querySelectorAll('.error-box, .success-box, section.section, form > .btn').forEach(el => {
    el.style.display = 'none';
  });

  const select = page.querySelector('.assessment-type-only select');
  if (!select) return;

  if (select.dataset.assessmentMethodsReady !== 'true') {
    select.innerHTML = TYPES.map(type => `<option value="${type}">${type}</option>`).join('');
    select.value = TYPES[0];
    select.dataset.assessmentMethodsReady = 'true';
  }
}

const style = document.createElement('style');
style.textContent = `
  .assessment-methods-clean .form-group { display: none !important; }
  .assessment-methods-clean .assessment-type-only { display: block !important; }
  .assessment-methods-clean .card-actions,
  .assessment-methods-clean section.section,
  .assessment-methods-clean .error-box,
  .assessment-methods-clean .success-box,
  .assessment-methods-clean form > .btn { display: none !important; }
`;
document.head.appendChild(style);

const observer = new MutationObserver(applyAssessmentMethodsView);
observer.observe(document.body, { childList: true, subtree: true });
applyAssessmentMethodsView();
