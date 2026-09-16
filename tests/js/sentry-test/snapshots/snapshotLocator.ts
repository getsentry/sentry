/* eslint-disable testing-library/prefer-screen-queries */
import type {Locator, Page} from 'playwright';

type SnapshotRole = Parameters<Locator['getByRole']>[0];

interface ExactOptions {
  exact?: boolean;
}

export type SnapshotLocator =
  | {exact: boolean; name: string; role: SnapshotRole; type: 'role'}
  | {exact: boolean; label: string; type: 'label'}
  | {exact: boolean; text: string; type: 'text'}
  | {testId: string; type: 'testId'}
  | {selector: string; type: 'css'};

export const snapshotLocator = {
  role(role: SnapshotRole, name: string, {exact = true}: ExactOptions = {}) {
    return {type: 'role', role, name, exact} as const;
  },
  label(label: string, {exact = true}: ExactOptions = {}) {
    return {type: 'label', label, exact} as const;
  },
  text(text: string, {exact = true}: ExactOptions = {}) {
    return {type: 'text', text, exact} as const;
  },
  testId(testId: string) {
    return {type: 'testId', testId} as const;
  },
  css(selector: string) {
    return {type: 'css', selector} as const;
  },
};

export function formatSnapshotLocator(target: SnapshotLocator): string {
  switch (target.type) {
    case 'role':
      return `role(${JSON.stringify(target.role)}, {name: ${JSON.stringify(target.name)}, exact: ${target.exact}})`;
    case 'label':
      return `label(${JSON.stringify(target.label)}, {exact: ${target.exact}})`;
    case 'text':
      return `text(${JSON.stringify(target.text)}, {exact: ${target.exact}})`;
    case 'testId':
      return `testId(${JSON.stringify(target.testId)})`;
    case 'css':
      return `css(${JSON.stringify(target.selector)})`;
  }
}

export async function resolveSnapshotLocator(
  page: Page,
  target: SnapshotLocator
): Promise<Locator> {
  const root = page.locator('#root');
  let locator: Locator;

  switch (target.type) {
    case 'role':
      locator = root.getByRole(target.role, {name: target.name, exact: target.exact});
      break;
    case 'label':
      locator = root.getByLabel(target.label, {exact: target.exact});
      break;
    case 'text':
      locator = root.getByText(target.text, {exact: target.exact});
      break;
    case 'testId':
      locator = root.getByTestId(target.testId);
      break;
    case 'css':
      locator = root.locator(target.selector);
      break;
  }

  const count = await locator.count();
  if (count !== 1) {
    throw new Error(
      `Snapshot locator ${formatSnapshotLocator(target)} matched ${count} elements within #root; expected exactly one match`
    );
  }

  return locator;
}
