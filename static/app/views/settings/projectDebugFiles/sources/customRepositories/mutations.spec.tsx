import {useMutation} from '@tanstack/react-query';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {CustomRepoType} from 'sentry/types/debugFiles';

import {updateCustomRepositoriesMutationOptions} from './mutations';

const mutationOptions = updateCustomRepositoriesMutationOptions({
  currentRepositoryCount: 0,
  organizationSlug: 'org-slug',
  projectSlug: 'project-slug',
});

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

describe('updateCustomRepositoriesMutationOptions', () => {
  it('serializes repositories and updates the project store', async () => {
    const project = ProjectFixture();
    const request = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: project,
    });
    const updateProjectSpy = jest
      .spyOn(ProjectsStore, 'onUpdateSuccess')
      .mockImplementation(() => {});
    const successMessageSpy = jest.spyOn(indicators, 'addSuccessMessage');
    const {result} = renderHookWithProviders(() => useMutation(mutationOptions));

    await act(async () => {
      await result.current.mutateAsync({repositories: [repository]});
    });

    expect(request).toHaveBeenCalledTimes(1);
    const [, requestOptions] = request.mock.calls[0]!;
    expect(JSON.parse(requestOptions.data.symbolSources)).toEqual([
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
    expect(updateProjectSpy).toHaveBeenCalledWith(project);
    expect(successMessageSpy).toHaveBeenCalledWith(
      'Successfully added custom repository'
    );
  });

  it('shows an error message when the request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      statusCode: 500,
    });
    const errorMessageSpy = jest.spyOn(indicators, 'addErrorMessage');
    const {result} = renderHookWithProviders(() => useMutation(mutationOptions));

    await act(async () => {
      await expect(
        result.current.mutateAsync({repositories: [repository]})
      ).rejects.toBeDefined();
    });

    expect(errorMessageSpy).toHaveBeenCalledWith(
      'An error occurred while adding a new custom repository'
    );
  });
});
