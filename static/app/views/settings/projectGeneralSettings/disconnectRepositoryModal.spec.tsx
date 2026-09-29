import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {DisconnectRepositoryModal} from 'sentry/views/settings/projectGeneralSettings/disconnectRepositoryModal';

describe('DisconnectRepositoryModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const codeMappingsUrl = `/organizations/${organization.slug}/code-mappings/`;
  const repoListUrl = `/projects/${organization.slug}/${project.slug}/repo/`;

  const mapping1 = {
    id: '1',
    projectId: project.id,
    projectSlug: project.slug,
    repoId: '10',
    repoName: 'getsentry/sentry',
    stackRoot: 'src/',
    sourceRoot: 'src/app/',
    defaultBranch: 'main',
    hasCodeOwner: false,
    integrationId: 'gh-1',
    provider: null,
  };
  const mapping2 = {
    ...mapping1,
    id: '2',
    stackRoot: 'app/',
    sourceRoot: 'static/app/',
  };

  function renderModal(closeModal = jest.fn()) {
    return render(
      <DisconnectRepositoryModal
        Body={ModalBody}
        Footer={ModalFooter}
        Header={makeClosableHeader(jest.fn())}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        project={project}
        providerKey="github"
        repoName="getsentry/sentry"
        repositoryId="10"
      />,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the repo name and project slug in the header', async () => {
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1],
    });

    renderModal();

    expect(
      await screen.findByText(/Disconnect getsentry\/sentry from/)
    ).toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
  });

  it('lists the read-only path mappings being removed', async () => {
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1, mapping2],
    });

    renderModal();

    expect(await screen.findByText('src/')).toBeInTheDocument();
    expect(screen.getByText('app/')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Delete path mapping'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Add another path'})
    ).not.toBeInTheDocument();
  });

  it('shows still-connected project slugs from other projects sharing the same repo', async () => {
    const otherMapping = {
      ...mapping1,
      id: '3',
      projectId: '99',
      projectSlug: 'python-api',
    };
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1, otherMapping],
    });

    renderModal();

    expect(await screen.findByText('python-api')).toBeInTheDocument();
    expect(screen.getByText('STILL CONNECTED TO THIS REPOSITORY')).toBeInTheDocument();
  });

  it('omits the still-connected section when no other projects share the repo', async () => {
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1],
    });

    renderModal();

    await screen.findByText('src/');
    expect(
      screen.queryByText('STILL CONNECTED TO THIS REPOSITORY')
    ).not.toBeInTheDocument();
  });

  it('Cancel closes the modal without issuing any DELETEs', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1],
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `${codeMappingsUrl}${mapping1.id}/`,
      method: 'DELETE',
      body: {},
    });

    renderModal(closeModal);

    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    expect(closeModal).toHaveBeenCalled();
    expect(deleteRequest).not.toHaveBeenCalled();
  });

  it('DELETEs each mapping on confirm and closes', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1, mapping2],
    });
    const delete1 = MockApiClient.addMockResponse({
      url: `${codeMappingsUrl}${mapping1.id}/`,
      method: 'DELETE',
      body: {},
    });
    const delete2 = MockApiClient.addMockResponse({
      url: `${codeMappingsUrl}${mapping2.id}/`,
      method: 'DELETE',
      body: {},
    });
    // Invalidation refetches
    MockApiClient.addMockResponse({
      url: repoListUrl,
      method: 'GET',
      body: [],
    });

    renderModal(closeModal);

    await userEvent.click(await screen.findByRole('button', {name: 'Disconnect'}));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(delete1).toHaveBeenCalled();
    expect(delete2).toHaveBeenCalled();
  });

  it('shows an error toast and keeps the dialog open on 409', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: codeMappingsUrl,
      method: 'GET',
      body: [mapping1],
    });
    MockApiClient.addMockResponse({
      url: `${codeMappingsUrl}${mapping1.id}/`,
      method: 'DELETE',
      statusCode: 409,
      body: {detail: 'Code owner exists'},
    });

    renderModal(closeModal);

    await userEvent.click(await screen.findByRole('button', {name: 'Disconnect'}));

    await waitFor(() => {
      expect(screen.queryByRole('button', {name: /Disconnect/})).toBeInTheDocument();
    });
    expect(closeModal).not.toHaveBeenCalled();
  });
});
