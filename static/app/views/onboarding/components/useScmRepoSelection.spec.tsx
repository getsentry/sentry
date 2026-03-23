import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import type {IntegrationRepository} from 'sentry/types/integrations';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {useScmRepoSelection} from './useScmRepoSelection';

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
  };
}

describe('useScmRepoSelection', () => {
  const organization = OrganizationFixture();

  const mockIntegration = OrganizationIntegrationsFixture({
    id: '1',
    name: 'getsentry',
    domainName: 'github.com/getsentry',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: ['commits'],
      aspects: {},
    },
  });

  let onSelect: jest.Mock;
  let reposByIdentifier: Map<string, IntegrationRepository>;

  const mockRepo: IntegrationRepository = {
    identifier: 'getsentry/sentry',
    name: 'sentry',
    isInstalled: false,
  };

  const mockInstalledRepo: IntegrationRepository = {
    identifier: 'getsentry/sentry',
    name: 'sentry',
    isInstalled: true,
  };

  beforeEach(() => {
    sessionStorageWrapper.clear();
    onSelect = jest.fn();
    reposByIdentifier = new Map([['getsentry/sentry', mockRepo]]);

    // Default: no existing repos
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('calls POST to add new repo and updates onSelect with server ID', async () => {
    const addRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      body: {
        id: '42',
        name: 'getsentry/sentry',
        externalSlug: 'getsentry/sentry',
        status: 'active',
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({}),
      }
    );

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(addRequest).toHaveBeenCalled();
    // Optimistic call with empty id
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '', name: 'sentry'})
    );
    // Then real call with server response spread over optimistic
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '42', name: 'getsentry/sentry'})
    );
  });

  it('does not POST for already-installed repos, uses existing repo ID', async () => {
    reposByIdentifier = new Map([['getsentry/sentry', mockInstalledRepo]]);

    // Override repos response with an existing repo
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        {
          id: '99',
          name: 'getsentry/sentry',
          externalSlug: 'getsentry/sentry',
          status: 'active',
        },
      ],
    });

    const addRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({}),
      }
    );

    // Wait for existing repos query to resolve
    await waitFor(() => expect(result.current.busy).toBe(false));

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(addRequest).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '99', name: 'getsentry/sentry'})
    );
  });

  it('reverts onSelect on addRepository failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({}),
      }
    );

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    // Optimistic, then revert
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '', name: 'sentry'})
    );
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('cleans up previously added repo when selecting a new one', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      body: {
        id: '42',
        name: 'getsentry/sentry',
        externalSlug: 'getsentry/sentry',
        status: 'active',
      },
    });

    const hideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/`,
      method: 'PUT',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({}),
      }
    );

    // First selection
    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    // Add a second repo
    const secondRepo: IntegrationRepository = {
      identifier: 'getsentry/relay',
      name: 'relay',
      isInstalled: false,
    };
    reposByIdentifier.set('getsentry/relay', secondRepo);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      body: {
        id: '43',
        name: 'getsentry/relay',
        externalSlug: 'getsentry/relay',
        status: 'active',
      },
    });

    // Second selection should clean up the first
    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/relay'});
    });

    expect(hideRequest).toHaveBeenCalled();
  });

  it('does not call hideRepository on remove if repo was pre-existing', async () => {
    const hideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/99/`,
      method: 'PUT',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedRepository: {
            id: '99',
            name: 'sentry',
            externalSlug: 'getsentry/sentry',
          } as any,
        }),
      }
    );

    await act(async () => {
      await result.current.handleRemove();
    });

    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect(hideRequest).not.toHaveBeenCalled();
  });
});
