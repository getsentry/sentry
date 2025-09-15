import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';

import ResultsSearchQueryBuilder from './resultsSearchQueryBuilder';

function createTestProps(overrides = {}) {
  return {
    query: '',
    onSearch: jest.fn(),
    onChange: jest.fn(),
    projectIds: [],
    supportedTags: {
      environment: {key: 'environment', name: 'environment', kind: FieldKind.FIELD},
      p50: {key: 'p50', name: 'p50', kind: FieldKind.FUNCTION},
      transaction: {key: 'transaction', name: 'transaction', kind: FieldKind.FIELD},
      user: {key: 'user', name: 'user', kind: FieldKind.FIELD},
    },
    recentSearches: SavedSearchType.EVENT,
    ...overrides,
  };
}

describe('ResultsSearchQueryBuilder', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/tags/`,
      body: [{key: 'transaction', name: 'transaction', kind: FieldKind.FIELD}],
    });
  });

  it('does not show function tags in has: dropdown', async () => {
    const organization: Organization = OrganizationFixture({
      features: ['performance-view'],
    });

    render(
      <ResultsSearchQueryBuilder
        {...createTestProps({fields: [{field: 'p50(transaction.duration)'}]})}
      />,
      {
        organization,
      }
    );

    // Focus the input and type "has:p" to simulate a search for p50
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'has:p');

    // Wait for the dropdown to appear
    let listbox = await screen.findByRole('listbox');

    // Check that "p50" (a function tag) is NOT in the dropdown
    expect(within(listbox).queryByText('p50')).not.toBeInTheDocument();

    await userEvent.type(input, '{Enter}');

    // Check that a normal tag (e.g. "transaction") IS in the dropdown
    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit value for filter: has'})
    );
    await userEvent.type(
      await screen.findByRole('combobox', {name: 'Edit filter value'}),
      'transact'
    );

    listbox = await screen.findByRole('listbox');
    await within(listbox).findByText('transaction');
  });
});
