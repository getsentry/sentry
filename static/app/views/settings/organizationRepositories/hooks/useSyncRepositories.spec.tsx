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

  it('syncNow is undefined while the integration query is loading', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/',
      body: integration,
      asyncDelay: 10_000,
    });

    const {result} = renderHookWithProviders(() => useSyncRepositories(integration), {
      organization,
    });

    expect(result.current.syncNow).toBeUndefined();
  });

  it('syncNow becomes undefined while a sync is in progress', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useSyncRepositories(integration), {
      organization,
    });

    await waitFor(() => expect(result.current.syncNow).toBeDefined());

    act(() => {
      result.current.syncNow?.();
    });

    expect(result.current.syncNow).toBeUndefined();
  });

  it('triggers POST and sets isSyncing to true when syncNow is called', async () => {
    const syncRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useSyncRepositories(integration), {
      organization,
    });

    await waitFor(() => expect(result.current.syncNow).toBeDefined());

    act(() => {
      result.current.syncNow?.();
    });

    expect(syncRequest).toHaveBeenCalled();
    expect(result.current.isSyncing).toBe(true);
  });

  it('sets isSyncing to false and shows success toast when last_sync changes', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const onSynced = jest.fn();
    const {result} = renderHookWithProviders(
      () =>
        useSyncRepositories(integration, {
          onSynced,
          pollingConfig: [{pollInterval: 5_000, phaseTimeout: 30_000}],
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.syncNow).toBeDefined());

    jest.useFakeTimers();

    act(() => {
      result.current.syncNow?.();
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/',
      body: OrganizationIntegrationsFixture({
        id: '123',
        configData: {last_sync: 'new-value'},
      }),
    });

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    // Restore real timers so waitFor's interval can tick and the refetch
    // Promise chain resolves naturally.
    jest.useRealTimers();

    await waitFor(() => expect(result.current.isSyncing).toBe(false));

    expect(indicator.addSuccessMessage).toHaveBeenCalledWith(
      'Repositories synced successfully'
    );
    expect(onSynced).toHaveBeenCalled();
  });

  it('shows a still-syncing toast and advances poll interval at phase boundary', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () =>
        useSyncRepositories(integration, {
          pollingConfig: [
            {
              pollInterval: 5_000,
              phaseTimeout: 100,
              transitionToast: 'Repositories still syncing, this may take a few minutes',
            },
            {pollInterval: 30_000, phaseTimeout: 60_000},
          ],
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.syncNow).toBeDefined());

    jest.useFakeTimers();

    act(() => {
      result.current.syncNow?.();
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    jest.useRealTimers();

    expect(indicator.addLoadingMessage).toHaveBeenCalledWith(
      'Repositories still syncing, this may take a few minutes'
    );
    expect(result.current.isSyncing).toBe(true);
  });

  it('sets isSyncing to false and shows error toast after all phases are exhausted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/123/repo-sync/',
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () =>
        useSyncRepositories(integration, {
          pollingConfig: [{pollInterval: 5_000, phaseTimeout: 100}],
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.syncNow).toBeDefined());

    jest.useFakeTimers();

    act(() => {
      result.current.syncNow?.();
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    jest.useRealTimers();

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });

    expect(indicator.addErrorMessage).toHaveBeenCalledWith(
      'Repositories still syncing — giving up polling. Come back later to check.'
    );
  });
});
