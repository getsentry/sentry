import {DashboardFixture, DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  useDuplicateDashboard,
  useDuplicatePrebuiltDashboard,
} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
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
});

describe('useDuplicatePrebuiltDashboard', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('resolves and duplicates a prebuilt dashboard', async () => {
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
      body: DashboardFixture([], {id: '300'}),
    });

    const onSuccess = jest.fn();
    const {result} = renderHookWithProviders(
      () => useDuplicatePrebuiltDashboard({onSuccess}),
      {organization}
    );

    await act(async () => {
      await result.current.duplicatePrebuiltDashboard(PrebuiltDashboardId.WEB_VITALS);
    });

    expect(createMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({id: '300'}));
  });

  it('throws when no prebuiltId is provided', async () => {
    const {result} = renderHookWithProviders(() => useDuplicatePrebuiltDashboard({}), {
      organization,
    });

    await expect(result.current.duplicatePrebuiltDashboard(undefined)).rejects.toThrow(
      'Prebuilt dashboard ID is required'
    );
  });
});
