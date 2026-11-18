import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {useProjects} from './useProjects';

const org = OrganizationFixture();

describe('useProjects', () => {
  const mockProjects = [ProjectFixture()];

  it('provides projects from the team store', () => {
    act(() => ProjectsStore.loadInitialData(mockProjects));

    const {result} = renderHookWithProviders(useProjects, {organization: org});
    const {projects} = result.current;

    expect(projects).toEqual(mockProjects);
  });

  it('loads more projects when using onSearch', async () => {
    act(() => ProjectsStore.loadInitialData(mockProjects));

    const newProject3 = ProjectFixture({id: '3', slug: 'test-project3'});
    const newProject4 = ProjectFixture({id: '4', slug: 'test-project4'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [newProject3, newProject4],
    });

    const {result} = renderHookWithProviders(useProjects, {organization: org});
    const {onSearch} = result.current;

    // Works with append
    await act(() => onSearch('test'));

    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
    await waitFor(() => result.current.projects.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.projects).toEqual([...mockProjects, newProject3, newProject4]);

    // de-duplicates items in the query results
    mockRequest.mockClear();
    await act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.projects).toEqual([...mockProjects, newProject3, newProject4]);
  });

  it('provides only the specified slugs', async () => {
    act(() => ProjectsStore.loadInitialData(mockProjects));

    const projectFoo = ProjectFixture({id: '3', slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [projectFoo],
    });

    const {result} = renderHookWithProviders(useProjects, {
      organization: org,
      initialProps: {slugs: ['foo']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    const {projects} = result.current;
    expect(projects).toEqual(expect.arrayContaining([projectFoo]));
  });

  it('only loads slugs when needed', () => {
    act(() => ProjectsStore.loadInitialData(mockProjects));

    const {result} = renderHookWithProviders(useProjects, {
      organization: org,
      initialProps: {slugs: [mockProjects[0]!.slug]},
    });

    const {projects, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(projects).toEqual(expect.arrayContaining(mockProjects));
  });

  it('keeps all projects when the store loads before a slug fetch resolves', async () => {
    act(() => ProjectsStore.reset());

    const target = ProjectFixture({id: '1', slug: 'target'});
    const allProjects = [
      target,
      ProjectFixture({id: '2', slug: 'other-a'}),
      ProjectFixture({id: '3', slug: 'other-b'}),
    ];

    let resolveSlugFetch!: () => void;
    const slugFetchDone = new Promise<void>(r => (resolveSlugFetch = r));
    const slugRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [target],
      asyncDelay: slugFetchDone,
    });

    renderHookWithProviders(useProjects, {
      organization: org,
      initialProps: {slugs: ['target']},
    });
    expect(slugRequest).toHaveBeenCalled();

    act(() => ProjectsStore.loadInitialData(allProjects));

    await act(async () => {
      resolveSlugFetch();
      await slugFetchDone;
    });

    await waitFor(() => expect(ProjectsStore.getState().projects).toHaveLength(3));
  });
});
