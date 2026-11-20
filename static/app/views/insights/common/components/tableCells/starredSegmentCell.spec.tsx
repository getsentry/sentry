import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {STARRED_SEGMENT_TABLE_QUERY_KEY, StarredSegmentCell} from './starredSegmentCell';

const organization = OrganizationFixture();

const otherTableKey = apiOptions.as<unknown>()(
  '/organizations/$organizationIdOrSlug/events/',
  {
    path: {organizationIdOrSlug: organization.slug},
    query: {field: ['is_starred_transaction', 'transaction', 'project']},
    staleTime: 0,
  }
).queryKey;
const starredTableKey = [...otherTableKey, STARRED_SEGMENT_TABLE_QUERY_KEY];
const otherProjectTableKey = [
  ...apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organization.slug},
    query: {
      project: ['2'],
      field: ['is_starred_transaction', 'transaction', 'project.id'],
    },
    staleTime: 0,
  }).queryKey,
  STARRED_SEGMENT_TABLE_QUERY_KEY,
];
const checkout = {transaction: 'checkout', project: 'storefront'};
const login = {transaction: 'login', project: 'storefront'};
const otherCheckout = {transaction: 'checkout', project: 'mobile'};

function renderCell(otherProjectIsStarred = false) {
  const queryClient = makeTestQueryClient();
  ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: checkout.project})]);
  queryClient.setQueryData(starredTableKey, {
    json: {
      data: [
        {...checkout, is_starred_transaction: false},
        {...login, is_starred_transaction: false},
        {...otherCheckout, is_starred_transaction: otherProjectIsStarred},
      ],
    },
    headers: {},
  });
  queryClient.setQueryData(otherTableKey, {
    json: {data: [{transaction: 'checkout', is_starred_transaction: false}]},
    headers: {},
  });
  queryClient.setQueryData(otherProjectTableKey, {
    json: {
      data: [
        {
          transaction: 'checkout',
          'project.id': 2,
          is_starred_transaction: otherProjectIsStarred,
        },
      ],
    },
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

  it('stars the segment only in the selected project', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(starredTableKey)).toEqual({
        json: {
          data: [
            {...checkout, is_starred_transaction: true},
            {...login, is_starred_transaction: false},
            {...otherCheckout, is_starred_transaction: false},
          ],
        },
        headers: {},
      })
    );
    expect(queryClient.getQueryData(otherProjectTableKey)).toMatchObject({
      json: {data: [{transaction: 'checkout', is_starred_transaction: false}]},
    });
  });

  it('restores the selected project after a failed star and preserves the other project', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/starred-service-spans/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Update rejected'},
    });
    const queryClient = renderCell(true);

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await screen.findByText('Failed to star transaction');
    expect(queryClient.getQueryData(starredTableKey)).toMatchObject({
      json: {
        data: [
          {...checkout, is_starred_transaction: false},
          {...login, is_starred_transaction: false},
          {...otherCheckout, is_starred_transaction: true},
        ],
      },
    });
    expect(queryClient.getQueryData(otherProjectTableKey)).toMatchObject({
      json: {data: [{transaction: 'checkout', is_starred_transaction: true}]},
    });
  });

  it('leaves unmarked events tables unchanged even if they have the starred field', async () => {
    const queryClient = renderCell();

    await userEvent.click(
      screen.getByRole('button', {name: 'Toggle star for transaction'})
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(starredTableKey)).toMatchObject({
        json: {data: [{...checkout, is_starred_transaction: true}, {}, {}]},
      })
    );
    expect(queryClient.getQueryData(otherTableKey)).toEqual({
      json: {data: [{transaction: 'checkout', is_starred_transaction: false}]},
      headers: {},
    });
  });
});
