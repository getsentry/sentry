import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';

import {ResultsSearchQueryBuilder} from './resultsSearchQueryBuilder';

describe('ResultsSearchQueryBuilder', () => {
  let organization: Organization;
  beforeEach(() => {
    MockApiClient.clearMockResponses();

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

  const defaultProps = {
    query: '',
    onSearch: jest.fn(),
    onChange: jest.fn(),
    projectIds: [] as number[],
    supportedTags: {
      environment: {key: 'environment', name: 'environment', kind: FieldKind.FIELD},
      p50: {key: 'p50', name: 'p50', kind: FieldKind.FUNCTION},
      transaction: {key: 'transaction', name: 'transaction', kind: FieldKind.FIELD},
      user: {key: 'user', name: 'user', kind: FieldKind.FIELD},
    },
    recentSearches: SavedSearchType.EVENT,
    fields: [{field: 'p50(transaction.duration)'}],
  };

  it('does not show function tags in has: dropdown', async () => {
    render(<ResultsSearchQueryBuilder {...defaultProps} />, {organization});

    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await screen.findByRole('listbox');
    await userEvent.keyboard('has:p');

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('p50')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('shows normal tags, e.g. transaction, in the dropdown', async () => {
    render(<ResultsSearchQueryBuilder {...defaultProps} />, {organization});

    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await screen.findByRole('listbox');
    await userEvent.keyboard('transact');

    expect(
      await within(screen.getByRole('listbox')).findByRole('option', {
        name: 'transaction',
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
