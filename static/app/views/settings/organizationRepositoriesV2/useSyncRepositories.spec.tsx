import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicator from 'sentry/actionCreators/indicator';

import {useSyncRepositories} from './useSyncRepositories';

jest.mock('sentry/actionCreators/indicator');

describe('useSyncRepositories', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const integration = OrganizationIntegrationsFixture({
    id: '123',
    configData: {last_sync: 'old-value'},
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/',
      body: integration,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('triggers POST and sets isSyncing when syncNow is called', async () => {
    const syncRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useSyncRepositories([integration]), {
      organization,
    });

    act(() => {
      result.current['123']!.syncNow();
    });

    expect(result.current['123']!.isSyncing).toBe(true);
    expect(syncRequest).toHaveBeenCalled();
  });

  it('sets isSyncing: false and shows success toast when last_sync changes', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const onSynced = jest.fn();
    const {result} = renderHookWithProviders(
      () => useSyncRepositories([integration], {onSynced}),
      {organization}
    );

    act(() => {
      result.current['123']!.syncNow();
    });

    // Update mock to return a changed last_sync value for the next poll
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/',
      body: OrganizationIntegrationsFixture({
        id: '123',
        configData: {last_sync: 'new-value'},
      }),
    });

    // Trigger the polling refetch
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    await waitFor(() => {
      expect(result.current['123']!.isSyncing).toBe(false);
    });

    expect(indicator.addSuccessMessage).toHaveBeenCalled();
    expect(onSynced).toHaveBeenCalledWith(integration);

    jest.useRealTimers();
  });

  it('sets isSyncing: false and shows error toast after timeout', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => useSyncRepositories([integration], {timeoutMs: 100}),
      {organization}
    );

    act(() => {
      result.current['123']!.syncNow();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current['123']!.isSyncing).toBe(false);
    });

    expect(indicator.addErrorMessage).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
