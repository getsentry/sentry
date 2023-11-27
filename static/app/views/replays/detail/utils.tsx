import {ReplayClickElement} from 'sentry/views/replays/types';

export function filterItems<I extends object, K extends string>({
  filterFns,
  filterVals,
  items,
}: {
  filterFns: Record<K, (item: I, val: any) => boolean>;
  filterVals: Record<K, any>;
  items: undefined | I[];
}): I[] {
  return (
    items?.filter(item => {
      for (const key in filterFns) {
        const filter = filterFns[key];
        const val = filterVals[key];
        if (!filter(item, val)) {
          return false;
        }
      }
      return true;
    }) || []
  );
}

export function operationName(op: string) {
  return op.split('.')?.[1] ?? op;
}

export function getAriaLabel(str: string) {
  const matches = str.match(/\[aria=(.*)\]/g);
  if (!matches) {
    return '';
  }
  const pre = matches[0];
  const start = pre.indexOf('aria="') + 6;
  return pre.substring(start, pre.indexOf('"]', start));
}

function trimAttribute(elementAttribute, fullAlltribute) {
  return elementAttribute === '' ? '' : fullAlltribute;
}

export function constructSelector(element: ReplayClickElement) {
  const fullAlt = '[alt="' + element.alt + '"]';
  const alt = trimAttribute(element.alt, fullAlt);

  const fullAriaLabel = '[aria="' + element.aria_label + '"]';
  const ariaLabel = trimAttribute(element.aria_label, fullAriaLabel);

  const trimClass = element.class.filter(e => e !== '');
  const classWithPeriod = trimClass.join('.');
  const classNoPeriod = classWithPeriod.replace('.', '');
  const classes = trimAttribute(classNoPeriod, '.' + classWithPeriod);

  const id = trimAttribute(element.id, '#' + element.id);

  const fullRole = '[role="' + element.role + '"]';
  const role = trimAttribute(element.role, fullRole);

  const tag = element.tag;

  const fullTestId = '[data-test-id="' + element.testid + '"]';
  const testId = trimAttribute(element.testid, fullTestId);

  const fullTitle = '[title="' + element.title + '"]';
  const title = trimAttribute(element.title, fullTitle);

  const fullSelector =
    tag + id + classes + fullRole + fullAriaLabel + fullTestId + fullAlt + fullTitle;
  const selector = tag + id + classes + role + ariaLabel + testId + alt + title;
  return {fullSelector, selector};
}
