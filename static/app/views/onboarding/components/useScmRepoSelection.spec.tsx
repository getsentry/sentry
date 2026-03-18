import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as OnboardingContext from 'sentry/components/onboarding/onboardingContext';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';

import {useScmRepoSelection} from './useScmRepoSelection';

const mockUseOnboardingContext = jest.spyOn(OnboardingContext, 'useOnboardingContext');

describe('useScmRepoSelection', () => {
  const organization = OrganizationFixture();

  const mockIntegration: Integration = {
    id: '1',
    name: 'getsentry',
    domainName: 'github.com/getsentry',
    accountType: null,
    icon: null,
    gracePeriodEnd: '',
    status: 'active',
    organizationIntegrationStatus: 'active',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: ['commits'],
      aspects: {},
    },
    configOrganization: [],
    configData: {},
    externalId: '',
    organizationId: 0,
  } as unknown as Integration;

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

  let onSelect: jest.Mock;
  let reposByIdentifier: Map<string, IntegrationRepository>;

  function setupContext(overrides = {}) {
    mockUseOnboardingContext.mockReturnValue({
      selectedIntegration: mockIntegration,
      selectedRepository: undefined,
      setSelectedPlatform: jest.fn(),
      setSelectedIntegration: jest.fn(),
      setSelectedRepository: jest.fn(),
      setSelectedFeatures: jest.fn(),
      ...overrides,
    });
  }

  beforeEach(() => {
    onSelect = jest.fn();
    reposByIdentifier = new Map([['getsentry/sentry', mockRepo]]);

    setupContext();

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
      () => useScmRepoSelection({onSelect, reposByIdentifier}),
      {organization}
    );

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(addRequest).toHaveBeenCalled();
    // Optimistic call with empty id
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '', name: 'sentry'})
    );
    // Then real call with server id
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '42', name: 'sentry'})
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
      () => useScmRepoSelection({onSelect, reposByIdentifier}),
      {organization}
    );

    // Wait for existing repos query to resolve
    await waitFor(() => expect(result.current.adding).toBe(false));

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(addRequest).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '99', name: 'sentry'})
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
      () => useScmRepoSelection({onSelect, reposByIdentifier}),
      {organization}
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
      () => useScmRepoSelection({onSelect, reposByIdentifier}),
      {organization}
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
    setupContext({
      selectedRepository: {
        id: '99',
        name: 'sentry',
        externalSlug: 'getsentry/sentry',
      },
    });

    const hideRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/99/`,
      method: 'PUT',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => useScmRepoSelection({onSelect, reposByIdentifier}),
      {organization}
    );

    await act(async () => {
      await result.current.handleRemove();
    });

    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect(hideRequest).not.toHaveBeenCalled();
  });
});
