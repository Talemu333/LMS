const TYPES = ['Direct observation', 'Question and answer', 'Personal statement', 'Work practice'];

function configureAssessmentMethods() {
  const heading = [...document.querySelectorAll('h1')].find(el => el.textContent.trim() === 'Assessment Methods');
  if (!heading) return;
  const page = heading.parentElement;
  if (!page || page.dataset.assessmentConfigured === 'true') return;
  page.dataset.assessmentConfigured = 'true';

  const intro = [...page.querySelectorAll('p')].find(el => el.textContent.includes('Choose an assessment method'));
  if (intro) intro.textContent = 'Choose an assessment method to make it available to students.';

  const form = page.querySelector('form');
  if (!form) return;
  const groups = [...form.querySelectorAll('.form-group')];
  const typeGroup = groups.find(group => group.querySelector('label')?.textContent.trim() === 'Assessment type');
  if (!typeGroup) return;

  groups.forEach(group => {
    if (group !== typeGroup) group.style.display = 'none';
  });
  form.querySelectorAll('.two-col').forEach(group => { group.style.display = 'none'; });

  const select = typeGroup.querySelector('select');
  if (!select) return;
  select.innerHTML = '';
  TYPES.forEach((type, index) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    if (index === 0) option.selected = true;
    select.appendChild(option);
  });

  const hidden = (name, value) => {
    let input = form.querySelector(`[data-assessment-hidden="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.dataset.assessmentHidden = name;
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
  };

  const sync = () => {
    hidden('title', select.value);
    hidden('maxScore', '100');
  };
  select.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', sync, true);
}

const observer = new MutationObserver(configureAssessmentMethods);
observer.observe(document.body, { childList: true, subtree: true });
configureAssessmentMethods();
