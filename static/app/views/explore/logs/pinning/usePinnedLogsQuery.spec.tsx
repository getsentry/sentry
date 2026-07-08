import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {LogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const organization = OrganizationFixture({
  features: ['ourlogs-enabled', 'ourlogs-pinning'],
});
const project = ProjectFixture();

function makeLogsPinning(pinnedIds: string[]): LogsPinning {
  return {
    clearPinnedRows: jest.fn(),
    getPinnedRowIds: jest.fn().mockReturnValue(pinnedIds),
    hasPinnedRow: jest.fn((id: string) => pinnedIds.includes(id)),
    removePinnedRows: jest.fn(),
    togglePinnedRow: jest.fn(),
  };
}

function AdditionalWrapper({children}: {children: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('usePinnedLogsQuery', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('returns empty fetchedRows when all pinned ids are in allRows', () => {
    const logRow = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-1',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });
    const logsPinning = makeLogsPinning(['log-1']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [logRow], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    expect(result.current.fetchedRows).toEqual([]);
    expect(result.current.isPending).toBe(false);
  });

  it('returns empty fetchedRows when logsPinning is undefined', () => {
    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning: undefined}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    expect(result.current.fetchedRows).toEqual([]);
    expect(result.current.isPending).toBe(false);
  });

  it('fetches missing pinned rows from the selected range', async () => {
    const missingLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-missing',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: 'fetched log',
    });

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [missingLog],
        meta: {fields: {id: 'string'}, units: {}},
      },
    });

    const logsPinning = makeLogsPinning(['log-missing']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });

    expect(eventsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'id:[log-missing]',
          dataset: 'ourlogs',
          sampling: 'HIGHEST_ACCURACY',
          statsPeriod: '14d',
        }),
      })
    );
    expect(result.current.fetchedRows[0]?.[OurLogKnownFieldKey.ID]).toBe('log-missing');
  });

  it('does not escalate to the wide window when the selected range resolves every pin', async () => {
    const inRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-in-range',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [inRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    const wideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-in-range']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });

    expect(wideRequest).not.toHaveBeenCalled();
  });

  it('escalates only the unresolved ids to the wide window', async () => {
    const inRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-in-range',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });
    const outOfRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-out-of-range',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [inRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    const wideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [outOfRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-in-range', 'log-out-of-range']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(2);
    });

    expect(wideRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'id:[log-out-of-range]'}),
      })
    );
  });

  it('queries the wide window with a narrow range derived from the pin id when the id is a valid v7 timestamp', async () => {
    setMockDate(new Date('2026-06-18T05:00:00Z'));
    const v7Id = '019ed8e2be157592b89c4bd51c7bd1e7';
    const outOfRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: v7Id,
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    const wideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [outOfRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({start: '2026-06-18T03:54:58'})],
    });

    const logsPinning = makeLogsPinning([v7Id]);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });

    expect(wideRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          start: '2026-06-18T03:54:58',
          end: '2026-06-18T04:04:58',
        }),
      })
    );
  });

  it('falls back to the 9999d wide window when a missing pin id is not a decodable timestamp', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    const wideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}, dataScanned: 'partial'}},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['not-a-v7-id']);

    renderHookWithProviders(() => usePinnedLogsQuery({allRows: [], logsPinning}), {
      organization,
      additionalWrapper: AdditionalWrapper,
    });

    await waitFor(() => {
      expect(wideRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({statsPeriod: '9999d'}),
        })
      );
    });
  });

  it('falls back to the wide window when the in-range query fails', async () => {
    const outOfRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-out-of-range',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    const wideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [outOfRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-out-of-range']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });

    expect(wideRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'id:[log-out-of-range]'}),
      })
    );
  });

  it('reports isError when the pinned logs query fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const logsPinning = makeLogsPinning(['missing-log']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('reports isError when both the in-range and wide queries fail', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-out-of-range']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.fetchedRows).toHaveLength(0);
    expect(logsPinning.removePinnedRows).not.toHaveBeenCalled();
  });

  it('keeps the rows found in range when a straggler escalation fails', async () => {
    const foundA = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-a',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });
    const foundB = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-b',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [foundA, foundB], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-a', 'log-b', 'log-straggler']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(
      result.current.fetchedRows.map(row => row[OurLogKnownFieldKey.ID]).sort()
    ).toEqual(['log-a', 'log-b']);
  });

  it('returns a pin found only in the wide window', async () => {
    const outOfRangeLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-out-of-range',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [outOfRangeLog], meta: {fields: {id: 'string'}, units: {}}},
      match: [MockApiClient.matchQuery({statsPeriod: '9999d'})],
    });

    const logsPinning = makeLogsPinning(['log-out-of-range']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });
  });

  it('never unpins a pin that cannot be found, leaving it out of fetchedRows', async () => {
    const foundLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-found',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [foundLog], meta: {fields: {id: 'string'}, units: {}}},
    });

    const logsPinning = makeLogsPinning(['log-gone-1', 'log-found', 'log-gone-2']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });

    expect(result.current.fetchedRows[0]?.[OurLogKnownFieldKey.ID]).toBe('log-found');
    expect(logsPinning.removePinnedRows).not.toHaveBeenCalled();
  });

  it('is pending while fetching missing rows', async () => {
    let resolveRequest!: (value: unknown) => void;
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      asyncDelay: new Promise(resolve => {
        resolveRequest = resolve;
      }) as any,
      body: {data: [], meta: {fields: {}, units: {}}},
    });

    const logsPinning = makeLogsPinning(['log-pending']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    expect(result.current.isPending).toBe(true);

    act(() => {
      resolveRequest({});
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it('reports missing pins as pending while page filters are not ready', () => {
    PageFiltersStore.reset();

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {}, units: {}}},
    });

    const logsPinning = makeLogsPinning(['log-not-ready']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    expect(result.current.statusById.get('log-not-ready')).toBe('pending');
    expect(result.current.isPending).toBe(true);
    expect(eventsRequest).not.toHaveBeenCalled();
  });

  it('keeps already-fetched rows for the remaining pins when a pin is removed', async () => {
    const logA = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-a',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });
    const logB = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-b',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [logA, logB], meta: {fields: {id: 'string'}, units: {}}},
    });

    const {result, rerender} = renderHookWithProviders(
      ({ids}: {ids: string[]}) =>
        usePinnedLogsQuery({allRows: [], logsPinning: makeLogsPinning(ids)}),
      {
        organization,
        additionalWrapper: AdditionalWrapper,
        initialProps: {ids: ['log-a', 'log-b']},
      }
    );

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(2);
    });
    const callsBeforeUnpin = eventsRequest.mock.calls.length;

    rerender({ids: ['log-b']});

    expect(result.current.fetchedRows.map(row => row[OurLogKnownFieldKey.ID])).toEqual([
      'log-b',
    ]);
    // Unpinning serves the remaining pin from cache without refetching.
    expect(eventsRequest).toHaveBeenCalledTimes(callsBeforeUnpin);
  });

  it('refetches the pinned rows with the new fields when the visible columns change', async () => {
    const pinnedLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-cols',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [pinnedLog], meta: {fields: {id: 'string'}, units: {}}},
    });

    const logsPinning = makeLogsPinning(['log-cols']);

    const {result, router} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {
        organization,
        additionalWrapper: AdditionalWrapper,
        initialRouterConfig: {location: {pathname: '/', query: {logsFields: 'message'}}},
      }
    );

    const fieldsForCall = (call: unknown[]) =>
      (call[1] as {query: {field: string[]}}).query.field;

    await waitFor(() => {
      expect(result.current.fetchedRows).toHaveLength(1);
    });
    expect(eventsRequest).toHaveBeenCalledTimes(1);

    act(() => {
      router.navigate('/?logsFields=message&logsFields=my.custom.attr');
    });

    await waitFor(() => {
      expect(eventsRequest).toHaveBeenCalledTimes(2);
    });
    expect(fieldsForCall(eventsRequest.mock.calls[1])).toContain('my.custom.attr');
  });

  it('does not fetch when pinned ids are already in allRows', () => {
    const existingLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-existing',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {}, units: {}}},
    });

    const logsPinning = makeLogsPinning(['log-existing']);

    renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [existingLog], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    expect(eventsRequest).not.toHaveBeenCalled();
  });
});
