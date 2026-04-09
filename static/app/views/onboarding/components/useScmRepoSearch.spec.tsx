import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScmRepoSearch} from './useScmRepoSearch';

describe('useScmRepoSearch', () => {
  const organization = OrganizationFixture();
  const integrationId = '1';

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.useRealTimers();
  });

  function renderHook(selectedRepo?: Parameters<typeof useScmRepoSearch>[1]) {
    return renderHookWithProviders(() => useScmRepoSearch(integrationId, selectedRepo), {
      organization,
    });
  }

  it('does not fetch when search is empty', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {repos: []},
    });

    renderHook();

    expect(request).not.toHaveBeenCalled();
  });

  it('fetches repos after search is set', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {repos: []},
    });

    const {result} = renderHook();

    act(() => {
      result.current.setSearch('sentry');
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => expect(request).toHaveBeenCalled());
  });

  it('passes search query param to the API', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {repos: []},
    });

    const {result} = renderHook();

    act(() => {
      result.current.setSearch('sentry');
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({search: 'sentry', accessibleOnly: true}),
      })
    );
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

    act(() => {
      result.current.setSearch('get');
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => expect(result.current.reposByIdentifier.size).toBe(2));

    expect(result.current.reposByIdentifier.get('getsentry/sentry')).toEqual({
      identifier: 'getsentry/sentry',
      name: 'sentry',
      isInstalled: false,
    });

    expect(result.current.dropdownItems).toEqual([
      {value: 'getsentry/sentry', label: 'sentry', disabled: false},
      {value: 'getsentry/relay', label: 'relay', disabled: false},
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

    act(() => {
      result.current.setSearch('get');
      jest.advanceTimersByTime(200);
    });

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

    act(() => {
      result.current.setSearch('sentry');
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('returns empty results when search is cleared after searching', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/repos/`,
      body: {
        repos: [{identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false}],
      },
    });

    const {result} = renderHook();

    // Search and get results
    act(() => {
      result.current.setSearch('sentry');
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => expect(result.current.reposByIdentifier.size).toBe(1));

    // Clear search
    act(() => {
      result.current.setSearch('');
      jest.advanceTimersByTime(200);
    });

    // placeholderData returns undefined when debouncedSearch is empty
    await waitFor(() => expect(result.current.reposByIdentifier.size).toBe(0));
    expect(result.current.dropdownItems).toEqual([]);
  });
});
