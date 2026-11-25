import {RuleTester} from 'oxlint/plugins-dev';

import {preferAriaDisabledAssertion} from './preferAriaDisabledAssertion';

const ruleTester = new RuleTester();

const ENABLED = ".not.toHaveAttribute('aria-disabled', 'true')";
const DISABLED = ".toHaveAttribute('aria-disabled', 'true')";

function error(output: string, replacement: string) {
  return {
    messageId: 'preferAriaDisabledAssertion',
    suggestions: [{messageId: 'useAriaDisabled', data: {replacement}, output}],
  };
}

ruleTester.run('prefer-aria-disabled-assertion', preferAriaDisabledAssertion, {
  valid: [
    {
      name: 'role backed by a native disabled attribute',
      code: `expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();`,
    },
    {
      name: 'aria-disabled assertion on an enabled item',
      code: `expect(screen.getByRole('menuitemradio', {name: 'New'})).not.toHaveAttribute('aria-disabled', 'true');`,
    },
    {
      name: 'aria-disabled assertion on a disabled item',
      code: `expect(screen.getByRole('option', {name: 'Bar'})).toHaveAttribute('aria-disabled', 'true');`,
    },
    {
      name: 'role that is not a string literal',
      code: `expect(screen.getByRole(role)).toBeEnabled();`,
    },
    {
      name: 'let variable is not traced',
      code: `let item = screen.getByRole('menuitem'); item = screen.getByRole('button'); expect(item).toBeEnabled();`,
    },
    {
      name: 'element returned from a helper is not traced',
      code: `function getItem() { return screen.getByRole('menuitem'); } expect(getItem()).toBeEnabled();`,
    },
    {
      name: 'other queries are ignored',
      code: `expect(screen.getByText('menuitem')).toBeDisabled();`,
    },
    {
      name: 'other matchers on a menu item are fine',
      code: `expect(screen.getByRole('menuitem')).toBeInTheDocument();`,
    },
  ],
  invalid: [
    {
      name: 'toBeEnabled on screen.getByRole',
      code: `expect(screen.getByRole('menuitemradio', {name: 'New Query'})).toBeEnabled();`,
      errors: [
        error(
          `expect(screen.getByRole('menuitemradio', {name: 'New Query'}))${ENABLED};`,
          ENABLED
        ),
      ],
    },
    {
      name: 'toBeDisabled on an option',
      code: `expect(screen.getByRole('option', {name: 'Top 5'})).toBeDisabled();`,
      errors: [
        error(
          `expect(screen.getByRole('option', {name: 'Top 5'}))${DISABLED};`,
          DISABLED
        ),
      ],
    },
    {
      name: 'not.toBeEnabled asserts disabled',
      code: `expect(screen.getByRole('menuitem')).not.toBeEnabled();`,
      errors: [error(`expect(screen.getByRole('menuitem'))${DISABLED};`, DISABLED)],
    },
    {
      name: 'not.toBeDisabled asserts enabled',
      code: `expect(screen.getByRole('tab')).not.toBeDisabled();`,
      errors: [error(`expect(screen.getByRole('tab'))${ENABLED};`, ENABLED)],
    },
    {
      name: 'awaited findByRole inside within',
      code: `async function f() { expect(await within(menu).findByRole('menuitemcheckbox')).toBeEnabled(); }`,
      errors: [
        error(
          `async function f() { expect(await within(menu).findByRole('menuitemcheckbox'))${ENABLED}; }`,
          ENABLED
        ),
      ],
    },
    {
      name: 'destructured queryByRole',
      code: `expect(queryByRole('row')).toBeDisabled();`,
      errors: [error(`expect(queryByRole('row'))${DISABLED};`, DISABLED)],
    },
    {
      name: 'indexed getAllByRole',
      code: `expect(screen.getAllByRole('treeitem')[0]).toBeEnabled();`,
      errors: [error(`expect(screen.getAllByRole('treeitem')[0])${ENABLED};`, ENABLED)],
    },
    {
      name: 'awaited findAllByRole with at()',
      code: `async function f() { expect((await screen.findAllByRole('gridcell')).at(-1)).toBeDisabled(); }`,
      errors: [
        error(
          `async function f() { expect((await screen.findAllByRole('gridcell')).at(-1))${DISABLED}; }`,
          DISABLED
        ),
      ],
    },
    {
      name: 'const assigned from an awaited query',
      code: `async function f() { const item = await screen.findByRole('menuitemradio', {name: 'Add'}); expect(item).toBeEnabled(); }`,
      errors: [
        error(
          `async function f() { const item = await screen.findByRole('menuitemradio', {name: 'Add'}); expect(item)${ENABLED}; }`,
          ENABLED
        ),
      ],
    },
    {
      name: 'const chain through an indexed list',
      code: `const options = screen.getAllByRole('option'); const first = options[0]; expect(first).toBeDisabled();`,
      errors: [
        error(
          `const options = screen.getAllByRole('option'); const first = options[0]; expect(first)${DISABLED};`,
          DISABLED
        ),
      ],
    },
  ],
});
