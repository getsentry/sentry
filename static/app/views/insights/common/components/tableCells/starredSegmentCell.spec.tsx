import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';

import {STARRED_SEGMENT_TABLE_QUERY_KEY, StarredSegmentCell} from './starredSegmentCell';

const organization = OrganizationFixture();

const rows = [
  {transaction: 'checkout', is_starred_transaction: false},
  {transaction: 'login', is_starred_transaction: false},
];

const starredRows = [
  {transaction: 'checkout', is_starred_transaction: true},
  {transaction: 'login', is_starred_transaction: false},
];

const meta = {fields: {}, units: {}};

// `useGenericDiscoverQuery` caches `[data, statusText, responseMeta]`
const discoverQueryKey = [...STARRED_SEGMENT_TABLE_QUERY_KEY, 'events', {}];

// `useSpansWidgetQuery` fetches with `apiFetch`, which caches an `ApiResponse`
const widgetQueryKey = [
  ...STARRED_SEGMENT_TABLE_QUERY_KEY,
  ...apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organization.slug},
    staleTime: 0,
  }).queryKey,
];

function renderCell() {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(discoverQueryKey, [{data: rows, meta}, 'success', undefined]);
  queryClient.setQueryData(widgetQueryKey, {
    json: {data: rows, meta},
    headers: {},
    status: 200,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <StarredSegmentCell segmentName="checkout" isStarred={false} projectId="1" />
    </QueryClientProvider>,
    {organization}
  );

  return queryClient;
}

describe('StarredSegmentCell', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/starred-service-spans/`,
      method: 'POST',
      body: {},
    });
  });

  it('stars the row in discover tables', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(discoverQueryKey)).toEqual([
        {data: starredRows, meta},
        'success',
        undefined,
      ])
    );
  });

  it('stars the row in dashboard widgets', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(widgetQueryKey)).toEqual({
        json: {data: starredRows, meta},
        headers: {},
        status: 200,
      })
    );
  });
});
