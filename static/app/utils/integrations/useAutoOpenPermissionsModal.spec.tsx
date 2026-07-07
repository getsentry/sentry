import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import * as modalActions from 'sentry/actionCreators/modal';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {useAutoOpenPermissionsModal} from 'sentry/utils/integrations/useAutoOpenPermissionsModal';

interface Params {
  isConfigurationsLoading: boolean;
  organization: Organization;
  outdatedConfigurations: Integration[];
  provider: IntegrationProvider | undefined;
}

function makeProps(overrides: Partial<Params> = {}): Params {
  return {
    provider: GitHubIntegrationProviderFixture(),
    organization: OrganizationFixture(),
    outdatedConfigurations: [GitHubIntegrationFixture()],
    isConfigurationsLoading: false,
    ...overrides,
  };
}

const withParam = {
  initialRouterConfig: {location: {pathname: '/', query: {showPermsModal: '1'}}},
};

describe('useAutoOpenPermissionsModal', () => {
  let openModalSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset the URL so the nuqs adapter doesn't leak query state between tests.
    setWindowLocation('http://localhost/');
    openModalSpy = jest.spyOn(modalActions, 'openModal').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Let any throttled nuqs URL writes settle so they don't leak into the
    // next test's router state.
    await new Promise(resolve => setTimeout(resolve, 100));
    jest.restoreAllMocks();
  });

  it('opens the modal and clears the param for github with one outdated config', async () => {
    const {router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps(),
    });

    expect(openModalSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(router.location.query.showPermsModal).toBeUndefined();
    });
  });

  it('does not open when the param is absent', () => {
    renderHookWithProviders(useAutoOpenPermissionsModal, {
      initialRouterConfig: {location: {pathname: '/', query: {}}},
      initialProps: makeProps(),
    });

    expect(openModalSpy).not.toHaveBeenCalled();
  });

  it('does not open when the user cannot manage integrations', async () => {
    const {router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps({organization: OrganizationFixture({access: []})}),
    });

    expect(openModalSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(router.location.query.showPermsModal).toBeUndefined();
    });
  });

  it('does not open while configurations are loading', () => {
    renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps({isConfigurationsLoading: true}),
    });

    expect(openModalSpy).not.toHaveBeenCalled();
  });

  it('waits for refetched configurations before clearing the param', async () => {
    const {rerender, router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps({
        isConfigurationsLoading: true,
        outdatedConfigurations: [],
      }),
    });

    expect(openModalSpy).not.toHaveBeenCalled();
    expect(router.location.query.showPermsModal).toBe('1');

    rerender(
      makeProps({outdatedConfigurations: [GitHubIntegrationFixture({id: 'fresh'})]})
    );

    await waitFor(() => {
      expect(openModalSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('no-ops for non-github providers', async () => {
    const {router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps({
        provider: GitHubIntegrationProviderFixture({key: 'gitlab', slug: 'gitlab'}),
      }),
    });

    expect(openModalSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(router.location.query.showPermsModal).toBeUndefined();
    });
  });

  it.each([
    ['zero', [] as Integration[]],
    [
      'multiple',
      [
        GitHubIntegrationFixture({id: '1'}),
        GitHubIntegrationFixture({id: '2'}),
      ] as Integration[],
    ],
  ])(
    'does not open but still clears the param with %s outdated configs',
    async (_label, outdatedConfigurations) => {
      const {router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
        ...withParam,
        initialProps: makeProps({outdatedConfigurations}),
      });

      expect(openModalSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(router.location.query.showPermsModal).toBeUndefined();
      });
    }
  );

  it('opens only once across re-renders', async () => {
    const {rerender, router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps(),
    });

    await waitFor(() => {
      expect(router.location.query.showPermsModal).toBeUndefined();
    });

    rerender(makeProps());
    rerender(makeProps());

    expect(openModalSpy).toHaveBeenCalledTimes(1);
  });

  it('reopens on a fresh arrival after the param is re-added', async () => {
    const {router} = renderHookWithProviders(useAutoOpenPermissionsModal, {
      ...withParam,
      initialProps: makeProps(),
    });

    expect(openModalSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(router.location.query.showPermsModal).toBeUndefined();
    });

    router.navigate('/?showPermsModal=1');

    await waitFor(() => {
      expect(openModalSpy).toHaveBeenCalledTimes(2);
    });
  });
});
