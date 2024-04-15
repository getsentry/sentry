import type {ReplayClickElement} from 'sentry/views/replays/types';

function trimAttribute(elementAttribute, fullAlltribute) {
  return elementAttribute === '' ? '' : fullAlltribute;
}

// fullSelector is used for searches since searching without all attributes returns too many replays
// selector is shown when you hover on a selector and used to show what gets searched
// displaySelector is the selector shown in the selector widget/table
export default function constructSelector(element: ReplayClickElement) {
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

  const fullComponentName = '[data-sentry-component="' + element.component_name + '"]';
  const componentName = trimAttribute(element.component_name, fullComponentName);

  const fullSelector =
    tag +
    id +
    classes +
    fullRole +
    fullAriaLabel +
    fullTestId +
    fullAlt +
    fullTitle +
    fullComponentName;
  const selector =
    tag + id + classes + role + ariaLabel + testId + alt + title + componentName;
  const displaySelector = componentName
    ? element.component_name + id + role + ariaLabel + testId + alt + title
    : selector;

  return {fullSelector, selector, displaySelector};
}
