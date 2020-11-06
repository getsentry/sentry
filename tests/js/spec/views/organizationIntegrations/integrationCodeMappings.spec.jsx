import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import {Client} from 'app/api';
import IntegrationCodeMappings from 'app/views/organizationIntegrations/integrationCodeMappings';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) =>
    Client.addMockResponse({
      url,
      body,
    })
  );
};

describe('IntegrationCodeMappings', function () {
  const projects = [
    TestStubs.Project(),
    TestStubs.Project({
      id: '3',
      slug: 'some-project',
      name: 'Some Project',
    }),
  ];
  const org = TestStubs.Organization({
    projects,
  });
  const integration = TestStubs.GitHubIntegration();
  const repos = [
    TestStubs.Repository({
      integrationId: integration.id,
    }),

    TestStubs.Repository({
      integrationId: integration.id,
      id: '5',
      name: 'example/hello-there',
    }),
  ];

  const pathConfig1 = TestStubs.RepositoryProjectPathConfig(
    projects[0],
    repos[0],
    integration,
    {
      stackRoot: 'stack/root',
      sourceRoot: 'source/root',
    }
  );

  const pathConfig2 = TestStubs.RepositoryProjectPathConfig(
    projects[1],
    repos[1],
    integration,
    {
      id: '12',
      stackRoot: 'one/path',
      sourceRoot: 'another/root',
    }
  );

  let wrapper;

  beforeEach(() => {
    Client.clearMockResponses();

    mockResponse([
      [
        `/organizations/${org.slug}/integrations/${integration.id}/repo-project-path-configs/`,
        [pathConfig1, pathConfig2],
      ],
      [`/organizations/${org.slug}/repos/`, repos],
    ]);

    wrapper = mountWithTheme(
      <IntegrationCodeMappings organization={org} integration={integration} />
    );
  });
  it('shows the paths', () => {
    expect(wrapper.find('RepoName').length).toEqual(2);
    expect(wrapper.find('RepoName').at(0).text()).toEqual(repos[0].name);
    expect(wrapper.find('RepoName').at(1).text()).toEqual(repos[1].name);
  });

  it('opens modal', async () => {
    expect(wrapper.find('input[name="stackRoot"]')).toHaveLength(0);
    wrapper.find('button[aria-label="Add Mapping"]').first().simulate('click');
    await tick();
    expect(wrapper.find('input[name="stackRoot"]')).toHaveLength(1);
  });

  it('create new config', async () => {
    const stackRoot = 'my/root';
    const sourceRoot = 'hey/dude';
    const defaultBranch = 'release';
    const url = `/organizations/${org.slug}/integrations/${integration.id}/repo-project-path-configs/`;
    const createMock = Client.addMockResponse({
      url,
      method: 'POST',
      body: TestStubs.RepositoryProjectPathConfig(projects[1], repos[1], integration, {
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    wrapper.find('button[aria-label="Add Mapping"]').first().simulate('click');

    selectByValue(wrapper, projects[1].id, {control: true, name: 'projectId'});
    selectByValue(wrapper, repos[1].id, {name: 'repositoryId'});

    wrapper
      .find('input[name="stackRoot"]')
      .simulate('change', {target: {value: stackRoot}});
    wrapper
      .find('input[name="sourceRoot"]')
      .simulate('change', {target: {value: sourceRoot}});
    wrapper
      .find('input[name="defaultBranch"]')
      .simulate('change', {target: {value: defaultBranch}});
    wrapper.find('form').simulate('submit');

    expect(createMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          projectId: projects[1].id,
          repositoryId: repos[1].id,
          stackRoot,
          sourceRoot,
          defaultBranch,
        },
      })
    );
  });

  it('edit existing config', async () => {
    const stackRoot = 'new/root';
    const sourceRoot = 'source/root';
    const defaultBranch = 'master';
    const url = `/organizations/${org.slug}/integrations/${integration.id}/repo-project-path-configs/${pathConfig1.id}/`;
    const editMock = Client.addMockResponse({
      url,
      method: 'PUT',
      body: TestStubs.RepositoryProjectPathConfig(projects[0], repos[0], integration, {
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    wrapper.find('button[aria-label="edit"]').first().simulate('click');
    wrapper
      .find('input[name="stackRoot"]')
      .simulate('change', {target: {value: stackRoot}});
    wrapper.find('form').simulate('submit');
    expect(editMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          defaultBranch,
          projectId: '2',
          repositoryId: '4',
          sourceRoot,
          stackRoot,
        },
      })
    );
  });
});
