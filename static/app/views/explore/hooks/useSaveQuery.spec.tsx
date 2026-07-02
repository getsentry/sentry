import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpansSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/components/pageFilters/usePageFilters');

const mockUsePageFilters = jest.mocked(usePageFilters);

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('useSpansSaveQuery', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    mockUsePageFilters.mockReturnValue({
      isReady: true,
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: PageFiltersFixture({
        projects: [1],
        environments: ['production'],
        datetime: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          period: '1h',
          utc: false,
        },
      }),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('saves cross event queries', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'New Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            query: 'span.op:db',
            mode: 'samples',
            field: ['span.op', 'span.duration'],
            sort: ['-span.duration'],
            crossEvents: JSON.stringify([
              {query: 'span.op:cache', type: 'spans'},
              {query: 'severity:error', type: 'logs'},
            ]),
          },
        },
      },
    });

    await result.current.saveQuery('New Query', true);

    expect(saveQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          name: 'New Query',
          dataset: 'spans',
          projects: [1],
          environment: ['production'],
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          range: '1h',
          query: [
            expect.objectContaining({
              fields: ['span.op', 'span.duration'],
              orderby: '-span.duration',
              query: 'span.op:db',
            }),
          ],
          crossEvents: [
            {query: 'span.op:cache', type: 'spans'},
            {query: 'severity:error', type: 'logs'},
          ],
          starred: true,
        }),
      })
    );
  });

  it('updates cross event queries', async () => {
    const updateQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'PUT',
      body: {id: '123', name: 'Existing Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            id: '123',
            title: 'Existing Query',
            query: 'span.status:ok',
            mode: 'samples',
            crossEvents: JSON.stringify([{query: 'severity:info', type: 'logs'}]),
          },
        },
      },
    });

    await result.current.updateQuery();

    expect(updateQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/123/`,
      expect.objectContaining({
        method: 'PUT',
        data: expect.objectContaining({
          name: 'Existing Query',
          dataset: 'spans',
          crossEvents: [{query: 'severity:info', type: 'logs'}],
        }),
      })
    );
  });
});
