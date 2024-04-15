import type {ComponentProps} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder/searchQueryBuilder';
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

  it('can remove a token by clicking the delete button', async function () {
    render(
      <SearchQueryBuilder
        {...defaultProps}
        initialQuery="browser.name:firefox custom_tag_name:123"
      />
    );

    expect(
      screen.getByRole('row', {name: 'browser.name is firefox'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'custom_tag_name is 123'})).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('row', {name: 'browser.name is firefox'})).getByRole(
        'gridcell',
        {name: 'Remove token'}
      )
    );

    // Browser name token should be removed
    expect(
      screen.queryByRole('row', {name: 'browser.name is firefox'})
    ).not.toBeInTheDocument();

    // Custom tag token should still be present
    expect(screen.getByRole('row', {name: 'custom_tag_name is 123'})).toBeInTheDocument();
  });

  it('can create a new token by clicking options', async function () {
    render(<SearchQueryBuilder {...defaultProps} />);

    await userEvent.click(screen.getByRole('grid', {name: 'Query Builder'}));

    await userEvent.click(await screen.findByRole('option', {name: 'Browser Name'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Firefox'}));
    await userEvent.keyboard('{Escape}');

    expect(
      screen.getByRole('row', {name: 'browser.name is Firefox'})
    ).toBeInTheDocument();
  });
});
