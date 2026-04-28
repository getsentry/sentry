import {DashboardFixture, DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  useDuplicateDashboard,
  useDuplicatePrebuiltDashboard,
} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import type {DashboardFilters} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

describe('useDuplicateDashboard', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches and duplicates a non-prebuilt dashboard', async () => {
    const fetchMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/42/`,
      body: DashboardFixture([WidgetFixture()], {id: '42'}),
    });
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'POST',
      body: DashboardFixture([WidgetFixture()], {id: '100'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(() => useDuplicateDashboard({onSuccess}), {
      organization,
    });

    await act(async () => {
      await result.current(DashboardListItemFixture({id: '42'}), 'grid');
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({id: '100'}));
  });

  it('resolves linked dashboard IDs before duplicating a prebuilt dashboard', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'GET',
      body: [
        DashboardFixture([], {
          id: '55',
          prebuiltId: PrebuiltDashboardId.WEB_VITALS_SUMMARY,
        }),
      ],
    });
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'POST',
      body: DashboardFixture([], {id: '200'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(() => useDuplicateDashboard({onSuccess}), {
      organization,
    });

    await act(async () => {
      await result.current(
        DashboardListItemFixture({
          id: '-1',
          prebuiltId: PrebuiltDashboardId.WEB_VITALS,
        }),
        'grid'
      );
    });

    expect(createMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('copies saved filters and page filters when duplicating a prebuilt dashboard', async () => {
    const savedFilters: DashboardFilters = {
      globalFilter: [
        {
          dataset: WidgetType.SPANS,
          tag: {key: 'span.system', name: 'span.system'},
          value: 'postgresql',
        },
      ],
    };
    // Mock for fetchDashboard (saved instance with user's filters)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/55/`,
      body: DashboardFixture([], {
        id: '55',
        prebuiltId: PrebuiltDashboardId.BACKEND_QUERIES,
        filters: savedFilters,
        projects: [1, 2],
        environment: ['production'],
        period: '7d',
      }),
    });
    // Mock for resolveLinkedDashboardIds (resolves linked summary dashboard)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'GET',
      body: [
        DashboardFixture([], {
          id: '56',
          prebuiltId: PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
        }),
      ],
    });
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'POST',
      body: DashboardFixture([], {id: '200'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(() => useDuplicateDashboard({onSuccess}), {
      organization,
    });

    await act(async () => {
      await result.current(
        DashboardListItemFixture({
          id: '55',
          prebuiltId: PrebuiltDashboardId.BACKEND_QUERIES,
        }),
        'grid'
      );
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          filters: savedFilters,
          projects: [1, 2],
          environment: ['production'],
          period: '7d',
        }),
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('useDuplicatePrebuiltDashboard', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches saved dashboard details and duplicates with saved filters and page filters', async () => {
    const savedFilters: DashboardFilters = {
      globalFilter: [
        {
          dataset: WidgetType.SPANS,
          tag: {key: 'db.normalized_description', name: 'db.normalized_description'},
          value: '*billing*',
        },
      ],
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/55/`,
      body: DashboardFixture([], {
        id: '55',
        prebuiltId: PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
        filters: savedFilters,
        projects: [3, 4],
        environment: ['staging'],
        period: '14d',
      }),
    });
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'POST',
      body: DashboardFixture([], {id: '300'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(
      () => useDuplicatePrebuiltDashboard({onSuccess}),
      {organization}
    );

    await act(async () => {
      await result.current.duplicatePrebuiltDashboard('55');
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          filters: savedFilters,
          projects: [3, 4],
          environment: ['staging'],
          period: '14d',
        }),
      })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({id: '300'}));
  });

  it('resolves linked dashboard IDs from static config', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/55/`,
      body: DashboardFixture([], {
        id: '55',
        prebuiltId: PrebuiltDashboardId.WEB_VITALS,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'GET',
      body: [
        DashboardFixture([], {
          id: '77',
          prebuiltId: PrebuiltDashboardId.WEB_VITALS_SUMMARY,
        }),
      ],
    });
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      method: 'POST',
      body: DashboardFixture([], {id: '300'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(
      () => useDuplicatePrebuiltDashboard({onSuccess}),
      {organization}
    );

    await act(async () => {
      await result.current.duplicatePrebuiltDashboard('55');
    });

    expect(createMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({id: '300'}));
  });

  it('throws when no dashboardId is provided', async () => {
    const {result} = renderHookWithProviders(() => useDuplicatePrebuiltDashboard({}), {
      organization,
    });

    await expect(result.current.duplicatePrebuiltDashboard(undefined)).rejects.toThrow(
      'Dashboard ID is required'
    );
  });
});
