import {act} from 'react-test-renderer';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {
  DefaultLoadedPersistedStore,
  DefaultPersistedStore,
  PersistedStoreProvider,
  usePersistedStoreCategory,
} from 'sentry/stores/persistedStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('PersistedStore', function () {
  let org, wrapper;
  beforeEach(() => {
    org = TestStubs.Organization();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/`,
      body: {
        onboarding: {
          test: 1,
        },
      },
    });
    OrganizationStore.onUpdate(org, {replace: true});
    wrapper = ({children}) => (
      <PersistedStoreProvider>
        <OrganizationContext.Provider value={org}>
          {children}
        </OrganizationContext.Provider>
      </PersistedStoreProvider>
    );
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('provides the persisted data category from client-state API', async function () {
    const {result, waitForNextUpdate} = reactHooks.renderHook(usePersistedStoreCategory, {
      initialProps: 'onboarding' as const,
      wrapper,
    });
    await waitForNextUpdate();
    const [state] = result.current;

    expect(state).toMatchObject({
      test: 1,
    });
  });
  it('sets the persisted data category from client-state API', async function () {
    const {result, waitForNextUpdate} = reactHooks.renderHook(usePersistedStoreCategory, {
      initialProps: 'onboarding' as const,
      wrapper,
    });
    await waitForNextUpdate();
    const [_, setState] = result.current;
    const clientStateUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/onboarding/`,
      method: 'PUT',
    });
    act(() => {
      setState({test: 2} as any);
    });

    const [state2] = result.current;
    expect(state2).toMatchObject({
      test: 2,
    });
    expect(clientStateUpdate).toHaveBeenCalledWith(
      `/organizations/${org.slug}/client-state/onboarding/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          test: 2,
        },
      })
    );
  });
  it('deletes the persisted data category on set to null', async function () {
    const {result, waitForNextUpdate} = reactHooks.renderHook(usePersistedStoreCategory, {
      initialProps: 'onboarding' as const,
      wrapper,
    });
    await waitForNextUpdate();
    const [_, setState] = result.current;

    const clientStateDelete = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/onboarding/`,
      method: 'DELETE',
    });
    act(() => {
      setState(null);
    });
    const [state2] = result.current;
    expect(state2).toBe(DefaultPersistedStore.onboarding);
    expect(clientStateDelete).toHaveBeenCalledWith(
      `/organizations/${org.slug}/client-state/onboarding/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
  it('returns default when state is empty', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/`,
      body: {},
    });
    const {result, waitForNextUpdate} = reactHooks.renderHook(usePersistedStoreCategory, {
      initialProps: 'onboarding' as const,
      wrapper,
    });
    const [state] = result.current;
    expect(state).toBe(DefaultPersistedStore.onboarding);
    await waitForNextUpdate();
    const [state2] = result.current;
    expect(state2).toBe(DefaultLoadedPersistedStore.onboarding);
  });

  it('returns default when state fails to load', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/`,
      statusCode: 500,
    });
    const {result} = reactHooks.renderHook(usePersistedStoreCategory, {
      initialProps: 'onboarding' as const,
      wrapper,
    });
    const [state] = result.current;
    expect(state).toBe(DefaultPersistedStore.onboarding);
  });
});
