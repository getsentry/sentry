import {mountWithTheme} from 'sentry-test/enzyme';

import StacktraceLinkModal from 'sentry/components/events/interfaces/frame/stacktraceLinkModal';

describe('StacktraceLinkModal', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const integration = TestStubs.GitHubIntegration();
  const filename = '/sentry/app.py';
  const repo = TestStubs.Repository({integrationId: integration.id});
  const config = TestStubs.RepositoryProjectPathConfig(project, repo, integration);
  const sourceUrl = 'https://github.com/getsentry/sentry/blob/master/src/sentry/app.py';

  const closeModal = jest.fn();
  const modalElements = {
    Header: p => p.children,
    Body: p => p.children,
    Footer: p => p.children,
  };

  const createWrapper = (statusCode = 200) => {
    const configData = {
      stackRoot: '',
      sourceRoot: 'src/',
      integrationId: integration.id,
      repositoryId: repo.id,
      defaultBranch: 'master',
    };

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {...configData},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      method: 'POST',
      statusCode,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: filename, commitId: 'master', platform: 'python'},
      body: {config, sourceUrl, integrations: [integration]},
    });

    return mountWithTheme(
      <StacktraceLinkModal
        {...modalElements}
        closeModal={closeModal}
        filename={filename}
        integrations={[integration]}
        organization={org}
        project={project}
      />
    );
  };

  const submitQuickSetupInput = async wrapper => {
    wrapper.find('input').simulate('change', {target: {value: sourceUrl}});
    wrapper.find('Button[data-test-id="quick-setup-button"]').simulate('click');

    await tick();
    wrapper.update();
  };

  beforeEach(function () {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  it('renders manual setup option', async function () {
    const wrapper = createWrapper();
    expect(wrapper.find('IntegrationName').text()).toEqual('Test Integration');
  });

  it('closes modal after successful quick setup', async function () {
    const wrapper = createWrapper();
    await submitQuickSetupInput(wrapper);
    expect(closeModal).toHaveBeenCalled();
  });

  it('keeps modal open on unsuccessful quick setup', async function () {
    const wrapper = createWrapper(400);
    await submitQuickSetupInput(wrapper);
    expect(closeModal).not.toHaveBeenCalled();
  });
});
