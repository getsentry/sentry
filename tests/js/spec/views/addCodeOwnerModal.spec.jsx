import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import {Client} from 'sentry/api';
import {AddCodeOwnerModal} from 'sentry/views/settings/project/projectOwnership/addCodeOwnerModal';

describe('AddCodeOwnerModal', function () {
  const modalProps = {
    Body: p => p.children,
    Header: p => p.children,
    Footer: p => p.children,
    closeModal: jest.fn(() => null),
  };

  const org = TestStubs.Organization({features: ['integrations-codeowners']});
  const project = TestStubs.ProjectDetails();
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({
    integrationId: integration.id,
    id: '5',
    name: 'example/hello-there',
  });
  const codeMapping = TestStubs.RepositoryProjectPathConfig(project, repo, integration, {
    stackRoot: 'stack/root',
    sourceRoot: 'source/root',
  });

  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <AddCodeOwnerModal
        {...modalProps}
        api={new Client()}
        organization={org}
        project={project}
        codeMappings={[codeMapping]}
        onSave={() => {}}
      />
    );
    expect(wrapper.find('Button').prop('disabled')).toBe(true);
  });

  it('renders codeowner file', async function () {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      body: {html_url: 'blah', filepath: 'CODEOWNERS', raw: '* @MeredithAnya\n'},
    });
    const wrapper = mountWithTheme(
      <AddCodeOwnerModal
        {...modalProps}
        api={new Client()}
        organization={org}
        project={project}
        codeMappings={[codeMapping]}
        onSave={() => {}}
      />
    );

    selectByValue(wrapper, codeMapping.id, {name: 'codeMappingId'});
    await tick();
    wrapper.update();

    expect(wrapper.find('IconCheckmark').exists()).toBe(true);
    expect(wrapper.find('SourceFileBody').find('Button').prop('href')).toEqual('blah');
    expect(wrapper.find('SourceFileBody').text()).toContain('CODEOWNERS');
    expect(wrapper.state('codeownersFile').raw).toEqual('* @MeredithAnya\n');
  });

  it('renders no codeowner file found', async function () {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      statusCode: 404,
    });
    const wrapper = mountWithTheme(
      <AddCodeOwnerModal
        {...modalProps}
        api={new Client()}
        organization={org}
        project={project}
        codeMappings={[codeMapping]}
        onSave={() => {}}
      />
    );

    selectByValue(wrapper, codeMapping.id, {name: 'codeMappingId'});
    await tick();
    wrapper.update();

    expect(wrapper.find('IconNot').exists()).toBe(true);
    expect(wrapper.find('NoSourceFileBody').text()).toEqual('No codeowner file found.');
    expect(wrapper.state('codeownersFile')).toBe(null);
  });

  it('adds codeowner file', async function () {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      body: {html_url: 'blah', filepath: 'CODEOWNERS', raw: '* @MeredithAnya\n'},
    });
    const addFileRequest = Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/`,
      method: 'POST',
      body: {},
    });
    const wrapper = mountWithTheme(
      <AddCodeOwnerModal
        {...modalProps}
        api={new Client()}
        organization={org}
        project={project}
        codeMappings={[codeMapping]}
        onSave={() => {}}
      />
    );

    selectByValue(wrapper, codeMapping.id, {name: 'codeMappingId'});
    await tick();
    wrapper.update();

    wrapper.find('Footer').find('Button').simulate('click');
    await tick();
    wrapper.update();

    expect(addFileRequest).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/codeowners/`,
      expect.objectContaining({
        data: {raw: '* @MeredithAnya\n', codeMappingId: codeMapping.id},
      })
    );
    const closeModal = wrapper.prop('closeModal');
    expect(closeModal).toHaveBeenCalled();
  });
});
