import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {IntegrationRepository} from 'sentry/types/integrations';

import {useScmRepoSelection} from './useScmRepoSelection';

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

  beforeEach(() => {
    onSelect = jest.fn();
    reposByIdentifier = new Map([['getsentry/sentry', mockRepo]]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('uses existing repo when GET finds it, skips POST', async () => {
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
      {organization}
    );

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(addRequest).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '99', name: 'getsentry/sentry'})
    );
  });

  it('creates repo via POST when GET finds nothing', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });

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
    // Then real call with server response
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '42', name: 'getsentry/sentry'})
    );
  });

  it('reverts onSelect on POST failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
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

  it('reverts onSelect on GET failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {organization}
    );

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({id: '', name: 'sentry'})
    );
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('handleRemove calls onSelect with undefined', () => {
    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {organization}
    );

    act(() => {
      result.current.handleRemove();
    });

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('clears busy state after selection completes', async () => {
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

    const {result} = renderHookWithProviders(
      () =>
        useScmRepoSelection({integration: mockIntegration, onSelect, reposByIdentifier}),
      {organization}
    );

    expect(result.current.busy).toBe(false);

    await act(async () => {
      await result.current.handleSelect({value: 'getsentry/sentry'});
    });

    expect(result.current.busy).toBe(false);
  });
});
