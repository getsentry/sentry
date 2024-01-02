import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import StacktraceLinkModal from 'sentry/components/events/interfaces/frame/stacktraceLinkModal';
import * as analytics from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('StacktraceLinkModal', () => {
  const org = Organization();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();
  const filename = '/sentry/app.py';
  const repo = Repository({integrationId: integration.id});
  const config = RepositoryProjectPathConfig({project, repo, integration});
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
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl, integrations: [integration]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/derive-code-mappings/`,
      body: [],
    });
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('links to source code with one GitHub integration', () => {
    renderGlobalModal();
    act(() =>
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
      ))
    );

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
    act(() =>
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
      ))
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Repository URL'}),
      'sourceUrl'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
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

    renderGlobalModal({context: RouterContextFixture()});
    act(() =>
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
      ))
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Repository URL'}),
      'sourceUrl{enter}'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(closeModal).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText('We don’t have access to that', {exact: false})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'add your repo.'})).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/1/'
    );
  });

  it('displays suggestions from code mappings', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/derive-code-mappings/`,
      body: [
        {
          filename: 'stack/root/file/stack/root/file/stack/root/file.py',
          repo_name: 'getsentry/codemap',
          repo_branch: 'master',
          stacktrace_root: '/stack/root',
          source_path: '/source/root/',
        },
        {
          filename: 'stack/root/file.py',
          repo_name: 'getsentry/codemap',
          repo_branch: 'master',
          stacktrace_root: '/stack/root',
          source_path: '/source/root/',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {...configData},
    });

    renderGlobalModal();
    act(() =>
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
      ))
    );

    expect(
      await screen.findByText(
        'Select from one of these suggestions or paste your URL below'
      )
    ).toBeInTheDocument();
    const suggestion =
      'https://github.com/getsentry/codemap/blob/master/stack/root/file.py';
    expect(screen.getByText(suggestion)).toBeInTheDocument();

    // Paste and save suggestion
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Repository URL'}),
      suggestion
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
    });

    expect(analyticsSpy).toHaveBeenCalledWith(
      'integrations.stacktrace_complete_setup',
      expect.objectContaining({
        is_suggestion: true,
      })
    );
  });
});
