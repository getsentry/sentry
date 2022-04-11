import {act} from 'react-test-renderer';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {
  PersistedStoreProvider,
  usePersistedStoreCategory,
} from 'sentry/stores/persistedStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('PersistedStore', function () {
  it('provides, sets and deletes the persisted data category from client-state API', async function () {
    const org = TestStubs.Organization();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/`,
      body: {
        onboarding: {
          test: 1,
        },
      },
    });
    OrganizationStore.onUpdate(org);
    const wrapper = ({children}) => (
      <PersistedStoreProvider>
        <OrganizationContext.Provider value={org}>
          {children}
        </OrganizationContext.Provider>
      </PersistedStoreProvider>
    );

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      () => usePersistedStoreCategory('onboarding'),
      {wrapper}
    );
    await waitForNextUpdate();
    const [state, setState] = result.current;

    expect(state).toMatchObject({
      test: 1,
    });

    // Set
    const clientStateUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/onboarding/`,
      method: 'PUT',
    });

    act(() => {
      setState({test: 2});
    });

    const [state2, setState2] = result.current;
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

    // Delete
    const clientStateDelete = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/onboarding/`,
      method: 'DELETE',
    });
    act(() => {
      setState2(null);
    });
    const [state3, _] = result.current;
    expect(state3).toBe(null);
    expect(clientStateDelete).toHaveBeenCalledWith(
      `/organizations/${org.slug}/client-state/onboarding/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    MockApiClient.clearMockResponses();
  });
  it('behaves nicely when state not loaded', async function () {
    const org = TestStubs.Organization();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/`,
      status: 500,
    });
    OrganizationStore.onUpdate(org);
    const wrapper = ({children}) => (
      <PersistedStoreProvider>
        <OrganizationContext.Provider value={org}>
          {children}
        </OrganizationContext.Provider>
      </PersistedStoreProvider>
    );

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      () => usePersistedStoreCategory('onboarding'),
      {wrapper}
    );
    await waitForNextUpdate();
    const [state, setState] = result.current;
    expect(state).toBe(null);

    const clientStateUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/client-state/onboarding/`,
      method: 'PUT',
    });

    act(() => {
      setState({test: 2});
    });

    const [state2, _] = result.current;
    expect(state2).toMatchObject({
      test: 2,
    });
    expect(clientStateUpdate).toHaveBeenCalledWith(
      `/organizations/${org.slug}/client-state/onboarding/`,
      expect.objectContaining({
        data: {
          test: 2,
        },
      })
    );
    MockApiClient.clearMockResponses();
  });
});
