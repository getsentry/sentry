import {focusManager} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useScmRepos} from './useScmRepos';

describe('useScmRepos', () => {
  const organization = OrganizationFixture();
  const integrationId = '1';

  afterEach(() => {
    // Unmount active queries before restoring focus to avoid triggering another refetch.
    cleanup();
    focusManager.setFocused(undefined);
    MockApiClient.clearMockResponses();
  });

  function renderHook(selectedRepo?: Parameters<typeof useScmRepos>[1]) {
    return renderHookWithProviders(() => useScmRepos(integrationId, selectedRepo), {
      organization,
    });
  }

  it('fetches repos on mount', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {repos: []},
    });

    renderHook();

    await waitFor(() => expect(request).toHaveBeenCalled());
  });

  it('refetches repos when the window regains focus', async () => {
    focusManager.setFocused(false);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {
        repos: [{identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false}],
      },
    });

    const {result} = renderHook();
    await waitFor(() => expect(result.current.dropdownItems).toHaveLength(1));

    MockApiClient.clearMockResponses();
    const refetchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/new-repo', name: 'new-repo', isInstalled: false},
        ],
      },
    });
    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(refetchRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.dropdownItems).toHaveLength(2));
  });

  it('transforms API response into reposByIdentifier and dropdownItems', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/relay', name: 'relay', isInstalled: false},
        ],
      },
    });

    const {result} = renderHook();

    await waitFor(() => expect(result.current.reposByIdentifier.size).toBe(2));

    expect(result.current.reposByIdentifier.get('getsentry/sentry')).toEqual({
      identifier: 'getsentry/sentry',
      name: 'sentry',
      isInstalled: false,
    });

    expect(result.current.dropdownItems).toEqual([
      {
        value: 'getsentry/sentry',
        label: 'sentry',
        textValue: 'sentry',
        disabled: false,
      },
      {
        value: 'getsentry/relay',
        label: 'relay',
        textValue: 'relay',
        disabled: false,
      },
    ]);
  });

  it('marks selected repo as disabled in dropdownItems', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/relay', name: 'relay', isInstalled: false},
        ],
      },
    });

    const selectedRepo = RepositoryFixture({externalSlug: 'getsentry/sentry'});
    const {result} = renderHook(selectedRepo);

    await waitFor(() => expect(result.current.dropdownItems).toHaveLength(2));

    expect(result.current.dropdownItems[0]).toEqual(
      expect.objectContaining({value: 'getsentry/sentry', disabled: true})
    );
    expect(result.current.dropdownItems[1]).toEqual(
      expect.objectContaining({value: 'getsentry/relay', disabled: false})
    );
  });

  it('returns isError true on API failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {result} = renderHook();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
