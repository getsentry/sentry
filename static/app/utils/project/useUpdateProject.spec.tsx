import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {DetailedProjectFixture, ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

describe('useUpdateProject', () => {
  const organization = {slug: 'org-slug'};
  const projectEndpoint = `/projects/${organization.slug}/project-slug/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('updates a summary project from a cached detailed project', async () => {
    const queryClient = makeTestQueryClient();
    const project = ProjectFixture({id: '2', slug: 'project-slug'});
    const detailedProject = DetailedProjectFixture({
      ...project,
      options: {'sentry:existing-option': true},
      name: 'Original Project',
    });
    const queryKey = makeDetailedProjectQueryKey({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    });

    queryClient.setQueryData(queryKey, {headers: {}, json: detailedProject});

    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {...detailedProject, name: 'Updated Project'},
    });

    const {result} = renderHookWithProviders(() => useUpdateProject(project), {
      organization,
      additionalWrapper: ({children}: {children?: ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({name: 'Updated Project'});
    });

    expect(mock).toHaveBeenCalledWith(
      projectEndpoint,
      expect.objectContaining({
        method: 'PUT',
        data: {name: 'Updated Project'},
      })
    );
    expect(queryClient.getQueryData(queryKey)?.json).toMatchObject({
      name: 'Updated Project',
      options: {'sentry:existing-option': true},
    });
  });

  it('uses a detailed project prop and merges option updates', async () => {
    const queryClient = makeTestQueryClient();
    const project = DetailedProjectFixture({
      id: '2',
      slug: 'project-slug',
      options: {'sentry:existing-option': true},
    });
    const queryKey = makeDetailedProjectQueryKey({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    });

    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {
        ...project,
        options: {
          ...project.options,
          'sentry:new-option': false,
        },
      },
    });

    const {result} = renderHookWithProviders(() => useUpdateProject(project), {
      organization,
      additionalWrapper: ({children}: {children?: ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({options: {'sentry:new-option': false}});
    });

    expect(mock).toHaveBeenCalledWith(
      projectEndpoint,
      expect.objectContaining({
        method: 'PUT',
        data: {options: {'sentry:new-option': false}},
      })
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKey)?.json).toMatchObject({
        options: {
          'sentry:existing-option': true,
          'sentry:new-option': false,
        },
      })
    );
  });
});
