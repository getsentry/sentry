import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('fetches missing pinned rows from the API', async () => {
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
          statsPeriod: '9999d',
        }),
      })
    );
    expect(result.current.fetchedRows[0]?.[OurLogKnownFieldKey.ID]).toBe('log-missing');
  });

  it('does not call removePinnedRows when the scan was only partial', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {fields: {id: 'string'}, units: {}, dataScanned: 'partial'},
      },
    });

    const logsPinning = makeLogsPinning(['log-not-scanned']);

    const {result} = renderHookWithProviders(
      () => usePinnedLogsQuery({allRows: [], logsPinning}),
      {organization, additionalWrapper: AdditionalWrapper}
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(logsPinning.removePinnedRows).not.toHaveBeenCalled();
  });

  it('calls removePinnedRows with every id not found in the API response', async () => {
    const foundLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-found',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [foundLog],
        meta: {fields: {id: 'string'}, units: {}},
      },
    });

    const logsPinning = makeLogsPinning(['log-gone-1', 'log-found', 'log-gone-2']);

    renderHookWithProviders(() => usePinnedLogsQuery({allRows: [], logsPinning}), {
      organization,
      additionalWrapper: AdditionalWrapper,
    });

    await waitFor(() => {
      expect(logsPinning.removePinnedRows).toHaveBeenCalledWith([
        'log-gone-1',
        'log-gone-2',
      ]);
    });
  });

  it('does not call removePinnedRows for ids that are found in the API response', async () => {
    const foundLog = LogFixture({
      [OurLogKnownFieldKey.ID]: 'log-found',
      [OurLogKnownFieldKey.PROJECT_ID]: String(project.id),
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [foundLog],
        meta: {fields: {id: 'string'}, units: {}},
      },
    });

    const logsPinning = makeLogsPinning(['log-found']);

    renderHookWithProviders(() => usePinnedLogsQuery({allRows: [], logsPinning}), {
      organization,
      additionalWrapper: AdditionalWrapper,
    });

    await waitFor(() => {
      expect(logsPinning.removePinnedRows).not.toHaveBeenCalled();
    });
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
