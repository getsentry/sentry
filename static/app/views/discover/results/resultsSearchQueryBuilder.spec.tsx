import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';

import {ResultsSearchQueryBuilder} from './resultsSearchQueryBuilder';

describe('ResultsSearchQueryBuilder', () => {
  let organization: Organization;
  beforeEach(() => {
    organization = OrganizationFixture();
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
    render(
      <ResultsSearchQueryBuilder
        query=""
        onSearch={jest.fn()}
        onChange={jest.fn()}
        projectIds={[]}
        supportedTags={{
          environment: {key: 'environment', name: 'environment', kind: FieldKind.FIELD},
          p50: {key: 'p50', name: 'p50', kind: FieldKind.FUNCTION},
          transaction: {key: 'transaction', name: 'transaction', kind: FieldKind.FIELD},
          user: {key: 'user', name: 'user', kind: FieldKind.FIELD},
        }}
        recentSearches={SavedSearchType.EVENT}
        // This fields definition is what caused p50 to appear as a function tag
        fields={[{field: 'p50(transaction.duration)'}]}
      />,
      {
        organization,
      }
    );

    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'has:p', {delay: null});

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('p50')).not.toBeInTheDocument();
  });

  it('shows normal tags, e.g. transaction, in the dropdown', async () => {
    render(
      <ResultsSearchQueryBuilder
        query=""
        onSearch={jest.fn()}
        onChange={jest.fn()}
        projectIds={[]}
        supportedTags={{
          environment: {key: 'environment', name: 'environment', kind: FieldKind.FIELD},
          p50: {key: 'p50', name: 'p50', kind: FieldKind.FUNCTION},
          transaction: {key: 'transaction', name: 'transaction', kind: FieldKind.FIELD},
          user: {key: 'user', name: 'user', kind: FieldKind.FIELD},
        }}
        recentSearches={SavedSearchType.EVENT}
        // This fields definition is what caused p50 to appear as a function tag
        fields={[{field: 'p50(transaction.duration)'}]}
      />,
      {
        organization,
      }
    );

    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'transact', {delay: null});

    expect(
      await within(screen.getByRole('listbox')).findByRole('option', {
        name: 'transaction',
      })
    ).toBeInTheDocument();
  });
});
