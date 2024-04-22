import type {ComponentProps} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {TagCollection} from 'sentry/types';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

const MOCK_SUPPORTED_KEYS: TagCollection = {
  [FieldKey.AGE]: {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['me', 'unassigned', 'person@sentry.io'],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  custom_tag_name: {key: 'custom_tag_name', name: 'Custom_Tag_Name', kind: FieldKind.TAG},
};

describe('SearchQueryBuilder', function () {
  const defaultProps: ComponentProps<typeof SearchQueryBuilder> = {
    getTagValues: jest.fn(),
    initialQuery: '',
    supportedKeys: MOCK_SUPPORTED_KEYS,
    label: 'Query Builder',
  };

  describe('mouse interactions', function () {
    it('can remove a token by clicking the delete button', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox custom_tag_name:123"
        />
      );

      expect(screen.getByRole('row', {name: 'browser.name:firefox'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'custom_tag_name:123'})).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole('row', {name: 'browser.name:firefox'})).getByRole(
          'gridcell',
          {name: 'Remove token'}
        )
      );

      // Browser name token should be removed
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();

      // Custom tag token should still be present
      expect(screen.getByRole('row', {name: 'custom_tag_name:123'})).toBeInTheDocument();
    });

    it('can modify the operator by clicking into it', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Should display as "is" to start
      expect(
        within(screen.getByRole('gridcell', {name: 'Edit token operator'})).getByText(
          'is'
        )
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Edit token operator'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'is not'}));

      // Token should be modified to be negated
      expect(
        screen.getByRole('row', {name: '!browser.name:firefox'})
      ).toBeInTheDocument();

      // Should now have "is not" label
      expect(
        within(screen.getByRole('gridcell', {name: 'Edit token operator'})).getByText(
          'is not'
        )
      ).toBeInTheDocument();
    });
  });
});
