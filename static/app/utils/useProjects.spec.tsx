import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import useProjects from 'sentry/utils/useProjects';
import {OrganizationContext} from 'sentry/views/organizationContext';

const org = OrganizationFixture();
function TestContext({children}: {children?: ReactNode}) {
  return (
    <OrganizationContext.Provider value={org}>{children}</OrganizationContext.Provider>
  );
}

describe('useProjects', function () {
  const mockProjects = [ProjectFixture()];

  it('provides projects from the team store', function () {
    act(() => void ProjectsStore.loadInitialData(mockProjects));

    const {result} = renderHook(useProjects, {wrapper: TestContext});
    const {projects} = result.current;

    expect(projects).toEqual(mockProjects);
  });

  it('loads more projects when using onSearch', async function () {
    act(() => void ProjectsStore.loadInitialData(mockProjects));

    const newProject3 = ProjectFixture({id: '3', slug: 'test-project3'});
    const newProject4 = ProjectFixture({id: '4', slug: 'test-project4'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [newProject3, newProject4],
    });

    const {result} = renderHook(useProjects, {
      wrapper: TestContext,
    });
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

  it('provides only the specified slugs', async function () {
    act(() => void ProjectsStore.loadInitialData(mockProjects));

    const projectFoo = ProjectFixture({id: '3', slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [projectFoo],
    });

    const {result} = renderHook(useProjects, {
      initialProps: {slugs: ['foo']},
      wrapper: TestContext,
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.projects.length).toBe(1));

    const {projects} = result.current;
    expect(projects).toEqual(expect.arrayContaining([projectFoo]));
  });

  it('only loads slugs when needed', function () {
    act(() => void ProjectsStore.loadInitialData(mockProjects));

    const {result} = renderHook(useProjects, {
      initialProps: {slugs: [mockProjects[0]!.slug]},
      wrapper: TestContext,
    });

    const {projects, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(projects).toEqual(expect.arrayContaining(mockProjects));
  });
});
