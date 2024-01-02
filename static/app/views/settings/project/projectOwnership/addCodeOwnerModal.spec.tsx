import selectEvent from 'react-select-event';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {AddCodeOwnerModal} from 'sentry/views/settings/project/projectOwnership/addCodeOwnerModal';

describe('AddCodeOwnerModal', function () {
  const org = Organization({features: ['integrations-codeowners']});
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();
  const repo = Repository({
    integrationId: integration.id,
    id: '5',
    name: 'example/hello-there',
  });

  const codeMapping = RepositoryProjectPathConfig({
    project,
    repo,
    integration,
    stackRoot: 'stack/root',
    sourceRoot: 'source/root',
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      method: 'GET',
      body: [codeMapping],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [integration],
    });
  });

  it('renders', function () {
    render(
      <AddCodeOwnerModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        organization={org}
        project={project}
      />
    );

    expect(screen.getByRole('button', {name: 'Add File'})).toBeDisabled();
  });

  it('renders codeowner file', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      body: {html_url: 'blah', filepath: 'CODEOWNERS', raw: '* @MeredithAnya\n'},
    });

    render(
      <AddCodeOwnerModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        organization={org}
        project={project}
      />
    );

    await selectEvent.select(screen.getByText('--'), 'example/hello-there');

    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Preview File'})).toHaveAttribute(
      'href',
      'blah'
    );
  });

  it('renders no codeowner file found', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      statusCode: 404,
    });

    render(
      <AddCodeOwnerModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        organization={org}
        project={project}
      />
    );

    await selectEvent.select(screen.getByText('--'), 'example/hello-there');

    expect(screen.getByText('No codeowner file found.')).toBeInTheDocument();
  });

  it('adds codeowner file', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/${codeMapping.id}/codeowners/`,
      method: 'GET',
      body: {html_url: 'blah', filepath: 'CODEOWNERS', raw: '* @MeredithAnya\n'},
    });

    const addFileRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/`,
      method: 'POST',
      body: {},
    });

    const handleCloseModal = jest.fn();

    render(
      <AddCodeOwnerModal
        Body={ModalBody}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        organization={org}
        project={project}
      />
    );

    await selectEvent.select(screen.getByText('--'), 'example/hello-there');

    await userEvent.click(screen.getByRole('button', {name: 'Add File'}));

    await waitFor(() => {
      expect(addFileRequest).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/codeowners/`,
        expect.objectContaining({
          data: {codeMappingId: '2', raw: '* @MeredithAnya\n'},
        })
      );
    });

    expect(handleCloseModal).toHaveBeenCalled();
  });
});
