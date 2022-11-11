import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import StacktraceLinkModal from 'sentry/components/events/interfaces/frame/stacktraceLinkModal';

describe('StacktraceLinkModal', () => {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const integration = TestStubs.GitHubIntegration();
  const filename = '/sentry/app.py';
  const repo = TestStubs.Repository({integrationId: integration.id});
  const config = TestStubs.RepositoryProjectPathConfig({project, repo, integration});
  const sourceUrl = 'https://github.com/getsentry/sentry/blob/master/src/sentry/app.py';
  const configData = {
    stackRoot: '',
    sourceRoot: 'src/',
    integrationId: integration.id,
    repositoryId: repo.id,
    defaultBranch: 'master',
  };
  const onSubmit = jest.fn();
  const closeModal = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl, integrations: [integration]},
    });
  });

  it('links to source code with one GitHub integration', () => {
    renderGlobalModal();
    openModal(modalProps => (
      <StacktraceLinkModal
        {...modalProps}
        filename={filename}
        closeModal={closeModal}
        integrations={[integration]}
        organization={org}
        project={project}
        onSubmit={onSubmit}
      />
    ));

    expect(screen.getByText('Tell us where your source code is')).toBeInTheDocument();

    // Links to GitHub with one integration
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toHaveAttribute(
      'href',
      'https://github.com/test-integration'
    );
  });

  it('closes modal after successful quick setup', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {...configData},
    });

    renderGlobalModal();
    openModal(modalProps => (
      <StacktraceLinkModal
        {...modalProps}
        filename={filename}
        closeModal={closeModal}
        integrations={[integration]}
        organization={org}
        project={project}
        onSubmit={onSubmit}
      />
    ));

    userEvent.type(
      screen.getByRole('textbox', {name: 'Copy the URL and paste it below'}),
      'sourceUrl{enter}'
    );
    userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps modal open on unsuccessful quick setup', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {sourceUrl: ['Could not find repo']},
      statusCode: 400,
    });

    renderGlobalModal({context: TestStubs.routerContext()});
    openModal(modalProps => (
      <StacktraceLinkModal
        {...modalProps}
        filename={filename}
        closeModal={closeModal}
        integrations={[integration]}
        organization={org}
        project={project}
        onSubmit={onSubmit}
      />
    ));

    userEvent.type(
      screen.getByRole('textbox', {name: 'Copy the URL and paste it below'}),
      'sourceUrl{enter}'
    );
    userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(closeModal).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText('We don’t have access to that', {exact: false})
    ).toBeInTheDocument();
  });
});
