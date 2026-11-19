import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';

import {STARRED_SEGMENT_TABLE_QUERY_KEY, StarredSegmentCell} from './starredSegmentCell';

const organization = OrganizationFixture();

const otherTableKey = apiOptions.as<unknown>()(
  '/organizations/$organizationIdOrSlug/events/',
  {
    path: {organizationIdOrSlug: organization.slug},
    query: {field: ['is_starred_transaction', 'transaction']},
    staleTime: 0,
  }
).queryKey;
const starredTableKey = [...otherTableKey, STARRED_SEGMENT_TABLE_QUERY_KEY];

function renderCell() {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(starredTableKey, {
    json: {
      data: [
        {transaction: 'checkout', is_starred_transaction: false},
        {transaction: 'login', is_starred_transaction: false},
      ],
    },
    headers: {},
  });
  queryClient.setQueryData(otherTableKey, {
    json: {data: [{transaction: 'checkout', is_starred_transaction: false}]},
    headers: {},
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

  it('stars the segment in cached events tables', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(starredTableKey)).toEqual({
        json: {
          data: [
            {transaction: 'checkout', is_starred_transaction: true},
            {transaction: 'login', is_starred_transaction: false},
          ],
        },
        headers: {},
      })
    );
  });

  it('leaves unmarked events tables unchanged even if they have the starred field', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(starredTableKey)).toMatchObject({
        json: {data: [{transaction: 'checkout', is_starred_transaction: true}, {}]},
      })
    );
    expect(queryClient.getQueryData(otherTableKey)).toEqual({
      json: {data: [{transaction: 'checkout', is_starred_transaction: false}]},
      headers: {},
    });
  });
});
