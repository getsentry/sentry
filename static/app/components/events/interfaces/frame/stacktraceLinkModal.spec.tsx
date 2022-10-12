import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import StacktraceLinkModal from 'sentry/components/events/interfaces/frame/stacktraceLinkModal';

function createWrapper(statusCode: number, closeModal: () => {}) {
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
    body: {config, sourceUrl, integrations: [integration]},
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
      onSubmit={jest.fn()}
    />
  ));
}

describe('StacktraceLinkModal', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders manual setup option', function () {
    const closeModal = jest.fn();
    createWrapper(200, closeModal);
    expect(screen.getByText('Test Integration')).toBeInTheDocument();
  });

  it('closes modal after successful quick setup', async function () {
    const closeModal = jest.fn();
    createWrapper(200, closeModal);
    userEvent.type(screen.getByRole('textbox'), 'sourceUrl{enter}');
    userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
    });
  });

  it('keeps modal open on unsuccessful quick setup', async function () {
    const closeModal = jest.fn();
    createWrapper(400, closeModal);
    userEvent.type(screen.getByRole('textbox'), 'sourceUrl{enter}');
    userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => {
      expect(closeModal).not.toHaveBeenCalled();
    });
  });
});
