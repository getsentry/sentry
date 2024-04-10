import type {ReplayClickElement} from 'sentry/views/replays/types';

function trimAttribute(elementAttribute, fullAlltribute) {
  return elementAttribute === '' ? '' : fullAlltribute;
}

export default function constructSelector(element: ReplayClickElement) {
  const componentName = element.component_name;

  const tag = element.tag;

  const id = trimAttribute(element.id, '#' + element.id);

  const trimClass = element.class.filter(e => e !== '');
  const classWithPeriod = trimClass.join('.');
  const classNoPeriod = classWithPeriod.replace('.', '');
  const classes = trimAttribute(classNoPeriod, '.' + classWithPeriod);

  const fullAlt = '[alt="' + element.alt + '"]';
  const alt = trimAttribute(element.alt, fullAlt);

  const fullAriaLabel = '[aria="' + element.aria_label + '"]';
  const ariaLabel = trimAttribute(element.aria_label, fullAriaLabel);

  const fullRole = '[role="' + element.role + '"]';
  const role = trimAttribute(element.role, fullRole);

  const fullTestId = '[data-test-id="' + element.testid + '"]';
  const testId = trimAttribute(element.testid, fullTestId);

  const fullTitle = '[title="' + element.title + '"]';
  const title = trimAttribute(element.title, fullTitle);

  const identifier = componentName ? componentName : tag + id + classes;
  const fullSelector =
    identifier + fullRole + fullAriaLabel + fullTestId + fullAlt + fullTitle;
  const selector = identifier + role + ariaLabel + testId + alt + title;
  return {fullSelector, selector};
}
