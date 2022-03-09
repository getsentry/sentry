import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import useProjects from 'sentry/utils/useProjects';

describe('useProjects', function () {
  const org = TestStubs.Organization();

  const mockProjects = [TestStubs.Project()];

  it('provides projects from the team store', function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData(mockProjects));

    const {result} = reactHooks.renderHook(() => useProjects());
    const {projects} = result.current;

    expect(projects).toEqual(mockProjects);
  });

  it('loads more projects when using onSearch', async function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData(mockProjects));
    reactHooks.act(() => void OrganizationStore.onUpdate(org, {replace: true}));

    const newProject3 = TestStubs.Project({id: '3', slug: 'test-project3'});
    const newProject4 = TestStubs.Project({id: '4', slug: 'test-project4'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [newProject3, newProject4],
    });

    const {result, waitFor} = reactHooks.renderHook(() => useProjects());
    const {onSearch} = result.current;

    // Works with append
    const onSearchPromise = reactHooks.act(() => onSearch('test'));

    expect(result.current.fetching).toBe(true);
    await onSearchPromise;
    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
    await waitFor(() => result.current.projects.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.projects).toEqual([...mockProjects, newProject3, newProject4]);

    // de-duplicates items in the query results
    mockRequest.mockClear();
    await reactHooks.act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.projects).toEqual([...mockProjects, newProject3, newProject4]);
  });

  it('provides only the specified slugs', async function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData(mockProjects));
    reactHooks.act(() => void OrganizationStore.onUpdate(org, {replace: true}));

    const projectFoo = TestStubs.Project({id: 3, slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [projectFoo],
    });

    const {result, waitFor} = reactHooks.renderHook(props => useProjects(props), {
      initialProps: {slugs: ['foo']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.projects.length).toBe(1));

    const {projects} = result.current;
    expect(projects).toEqual(expect.arrayContaining([projectFoo]));
  });

  it('only loads slugs when needed', async function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData(mockProjects));

    const {result} = reactHooks.renderHook(props => useProjects(props), {
      initialProps: {slugs: [mockProjects[0].slug]},
    });

    const {projects, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(projects).toEqual(expect.arrayContaining(mockProjects));
  });
});
