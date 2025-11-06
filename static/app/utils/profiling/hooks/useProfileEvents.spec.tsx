import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {EventsResults} from 'sentry/utils/profiling/hooks/types';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';

describe('useProfileEvents', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('handles querying the api using discover', async () => {
    const organizationUsingTransactions = OrganizationFixture();

    const fields = ['count()'];

    const body: EventsResults<(typeof fields)[number]> = {
      data: [],
      meta: {fields: {}, units: {}},
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organizationUsingTransactions.slug}/events/`,
      body,
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          query: '(has:profile.id OR (has:profiler.id has:thread.id)) (transaction:foo)',
        }),
      ],
    });

    const {result} = renderHookWithProviders(useProfileEvents, {
      organization: organizationUsingTransactions,
      initialProps: {
        fields,
        query: 'transaction:foo',
        sort: {key: 'count()', order: 'desc' as const},
        referrer: '',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual(body);
  });

  it('handles api errors', async () => {
    const organization = OrganizationFixture();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      status: 400,
      statusCode: 400,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });

    const {result} = renderHookWithProviders(useProfileEvents, {
      initialProps: {
        fields: ['count()'],
        sort: {key: 'count()', order: 'desc' as const},
        referrer: '',
      },
    });

    await waitFor(() => result.current.isError);
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('formatSort', () => {
  it('uses the desc fallback', () => {
    const sort = formatSort(undefined, ['count()'], {
      key: 'count()',
      order: 'desc' as const,
    });
    expect(sort).toEqual({
      key: 'count()',
      order: 'desc',
    });
  });

  it('uses the asc fallback', () => {
    const sort = formatSort(undefined, ['count()'], {
      key: 'count()',
      order: 'asc' as const,
    });
    expect(sort).toEqual({
      key: 'count()',
      order: 'asc',
    });
  });

  it('uses the desc value', () => {
    const sort = formatSort('-p95()', ['p95()', 'count()'], {
      key: 'count()',
      order: 'asc' as const,
    });
    expect(sort).toEqual({
      key: 'p95()',
      order: 'desc',
    });
  });

  it('uses the asc value', () => {
    const sort = formatSort('p95()', ['p95()', 'count()'], {
      key: 'count()',
      order: 'desc' as const,
    });
    expect(sort).toEqual({
      key: 'p95()',
      order: 'asc',
    });
  });
});
