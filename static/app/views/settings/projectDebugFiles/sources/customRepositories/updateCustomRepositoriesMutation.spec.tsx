import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {CustomRepoType} from 'sentry/types/debugFiles';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';

import {useUpdateCustomRepositoriesMutation} from './updateCustomRepositoriesMutation';

const organization = {slug: 'org-slug'};
const project = DetailedProjectFixture({slug: 'project-slug', symbolSources: '[]'});
const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
const repository = {
  id: 'http-repository',
  name: 'HTTP Repository',
  password: {'hidden-secret': true},
  type: CustomRepoType.HTTP,
  url: 'https://example.com/symbols/',
  username: 'admin',
  'layout.casing': 'default',
  'layout.type': 'native',
} as const;
const serializedRepositories = JSON.stringify([
  {
    id: 'http-repository',
    layout: {casing: 'default', type: 'native'},
    name: 'HTTP Repository',
    password: {'hidden-secret': true},
    type: 'http',
    url: 'https://example.com/symbols/',
    username: 'admin',
  },
]);

function renderMutation(currentRepositoryCount = 0) {
  const queryClient = makeTestQueryClient();
  const queryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  queryClient.setQueryData(queryKey, {headers: {}, json: project});

  const hook = renderHookWithProviders(
    () => useUpdateCustomRepositoriesMutation(project, currentRepositoryCount),
    {
      organization,
      additionalWrapper: ({children}: {children?: ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }
  );

  return {queryClient, queryKey, ...hook};
}

describe('useUpdateCustomRepositoriesMutation', () => {
  it('serializes repositories and updates the detailed project cache', async () => {
    const updatedProject = {...project, symbolSources: serializedRepositories};
    const request = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: updatedProject,
    });
    const successMessageSpy = jest.spyOn(indicators, 'addSuccessMessage');
    const {queryClient, queryKey, result} = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({repositories: [repository]});
    });

    expect(request).toHaveBeenCalledWith(
      projectEndpoint,
      expect.objectContaining({method: 'PUT'})
    );
    const [, requestOptions] = request.mock.calls[0]!;
    expect(JSON.parse(requestOptions.data.symbolSources)).toEqual(
      JSON.parse(serializedRepositories)
    );
    expect(queryClient.getQueryData(queryKey)?.json.symbolSources).toBe(
      serializedRepositories
    );
    expect(successMessageSpy).toHaveBeenCalledWith(
      'Successfully added custom repository'
    );
  });

  it('restores the detailed project cache when the request fails', async () => {
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      statusCode: 500,
    });
    const errorMessageSpy = jest.spyOn(indicators, 'addErrorMessage');
    const {queryClient, queryKey, result} = renderMutation();

    await act(async () => {
      await expect(
        result.current.mutateAsync({repositories: [repository]})
      ).rejects.toBeDefined();
    });

    expect(queryClient.getQueryData(queryKey)?.json.symbolSources).toBe('[]');
    expect(errorMessageSpy).toHaveBeenCalledWith(
      'An error occurred while adding a new custom repository'
    );
  });
});
