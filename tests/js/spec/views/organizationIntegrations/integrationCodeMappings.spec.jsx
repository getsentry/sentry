import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';
import {selectByValue} from 'sentry-test/select-new';

import {Client} from 'sentry/api';
import ModalStore from 'sentry/stores/modalStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import IntegrationCodeMappings from 'sentry/views/organizationIntegrations/integrationCodeMappings';

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

  ProjectsStore.loadInitialData(projects);

  const org = TestStubs.Organization();
  const invalidOrg = TestStubs.Organization({
    access: [],
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
    ModalStore.init();
    Client.clearMockResponses();

    mockResponse([
      [`/organizations/${org.slug}/code-mappings/`, [pathConfig1, pathConfig2]],
      [`/organizations/${org.slug}/repos/`, repos],
    ]);

    wrapper = mountWithTheme(
      <IntegrationCodeMappings organization={org} integration={integration} />
    );
  });

  afterEach(() => {
    // Clear the fields from the GlobalModal after every test
    ModalStore.reset();
    ModalStore.teardown();
  });

  it('shows the paths', () => {
    expect(wrapper.find('RepoName').length).toEqual(2);
    expect(wrapper.find('RepoName').at(0).text()).toEqual(repos[0].name);
    expect(wrapper.find('RepoName').at(1).text()).toEqual(repos[1].name);
  });

  it('opens modal', async () => {
    const modal = await mountGlobalModal();

    expect(modal.find('input[name="stackRoot"]')).toHaveLength(0);
    wrapper.find('button[data-test-id="add-mapping-button"]').first().simulate('click');

    await tick();
    modal.update();

    expect(modal.find('input[name="stackRoot"]')).toHaveLength(1);
  });

  it('requires permissions to click', async () => {
    const invalidContext = TestStubs.routerContext([{organization: invalidOrg}]);
    wrapper = mountWithTheme(
      <IntegrationCodeMappings organization={invalidOrg} integration={integration} />,
      invalidContext
    );
    const modal = await mountGlobalModal(invalidContext);

    expect(modal.find('input[name="stackRoot"]')).toHaveLength(0);

    const addMappingButton = wrapper
      .find('Button[data-test-id="add-mapping-button"]')
      .first();
    expect(addMappingButton.prop('disabled')).toBe(true);
    addMappingButton.simulate('click');

    await tick();
    modal.update();

    expect(modal.find('input[name="stackRoot"]')).toHaveLength(0);
  });

  it('create new config', async () => {
    const stackRoot = 'my/root';
    const sourceRoot = 'hey/dude';
    const defaultBranch = 'release';
    const url = `/organizations/${org.slug}/code-mappings/`;
    const createMock = Client.addMockResponse({
      url,
      method: 'POST',
      body: TestStubs.RepositoryProjectPathConfig(projects[1], repos[1], integration, {
        stackRoot,
        sourceRoot,
        defaultBranch,
      }),
    });
    wrapper.find('button[data-test-id="add-mapping-button"]').first().simulate('click');

    const modal = await mountGlobalModal();

    selectByValue(modal, projects[1].id, {control: true, name: 'projectId'});
    selectByValue(modal, repos[1].id, {name: 'repositoryId'});

    modal
      .find('input[name="stackRoot"]')
      .simulate('change', {target: {value: stackRoot}});
    modal
      .find('input[name="sourceRoot"]')
      .simulate('change', {target: {value: sourceRoot}});
    modal
      .find('input[name="defaultBranch"]')
      .simulate('change', {target: {value: defaultBranch}});
    modal.find('form').simulate('submit');

    expect(createMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: projects[1].id,
          repositoryId: repos[1].id,
          stackRoot,
          sourceRoot,
          defaultBranch,
          integrationId: integration.id,
        }),
      })
    );
  });

  it('edit existing config', async () => {
    const stackRoot = 'new/root';
    const sourceRoot = 'source/root';
    const defaultBranch = 'master';
    const url = `/organizations/${org.slug}/code-mappings/${pathConfig1.id}/`;
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

    await tick();
    const modal = await mountGlobalModal();

    modal
      .find('input[name="stackRoot"]')
      .simulate('change', {target: {value: stackRoot}});
    modal.find('form').simulate('submit');

    expect(editMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({
          defaultBranch,
          projectId: '2',
          repositoryId: '4',
          sourceRoot,
          stackRoot,
        }),
      })
    );
  });
});
