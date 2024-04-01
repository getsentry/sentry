import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useProject from 'sentry/utils/project/useProject';
import type {QueryClient} from 'sentry/utils/queryClient';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/utils/useOrganization');

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProject', () => {
  const mockOrg = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(mockOrg);

  const project10 = ProjectFixture({id: '10', slug: 'ten'});
  const project20 = ProjectFixture({id: '20', slug: 'twenty'});

  it('should fetch by id when an id is passed in', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project10],
      match: [MockApiClient.matchQuery({query: 'id:10'})],
    });

    const {waitFor} = reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {id: project10.id},
    });

    await waitFor(() => expect(mockResponse).toHaveBeenCalled());
    expect(mockResponse).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({query: {query: 'id:10'}})
    );
  });

  it('should batch and fetch by id when an id is passed in', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/projects/`,
      body: [project10, project20],
      match: [MockApiClient.matchQuery({query: 'id:10 id:20'})],
    });

    const queryClient = makeTestQueryClient();
    const {waitFor} = reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(queryClient),
      initialProps: {id: project10.id},
    });
    reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(queryClient),
      initialProps: {id: project20.id},
    });

    await waitFor(() => expect(mockResponse).toHaveBeenCalled());
    expect(mockResponse).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({query: {query: 'id:10 id:20'}})
    );
  });

  it('should fetch by slug when a slug is passed in', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project10],
      match: [MockApiClient.matchQuery({query: 'slug:ten'})],
    });

    const {waitFor} = reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {slug: project10.slug},
    });

    await waitFor(() => expect(mockResponse).toHaveBeenCalled());
    expect(mockResponse).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({query: {query: 'slug:ten'}})
    );
  });

  it('should return projects by id if they are in the cache', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project10],
      match: [MockApiClient.matchQuery({query: 'id:10'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {id: project10.id},
    });

    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current).toBe(project10));
  });

  it('should return projects by slug if they are in the cache', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project10],
      match: [MockApiClient.matchQuery({query: 'slug:ten'})],
    });

    const {result, waitFor} = reactHooks.renderHook(useProject, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {slug: project10.slug},
    });

    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current).toBe(project10));
  });
});
