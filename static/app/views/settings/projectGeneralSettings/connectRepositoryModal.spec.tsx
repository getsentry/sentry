import {Fragment} from 'react';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

// Mock the virtualizer so all menu items render in JSDOM (no layout engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count, paddingStart = 0, paddingEnd = 0}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: paddingStart + i * 36,
        size: 36,
      })),
    getTotalSize: () => paddingStart + count * 36 + paddingEnd,
    measure: jest.fn(),
    measureElement: jest.fn(),
    scrollToIndex: jest.fn(),
  })),
}));

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {ConnectRepositoryModal} from 'sentry/views/settings/projectGeneralSettings/connectRepositoryModal';

describe('ConnectRepositoryModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();

  function renderModal(closeModal = jest.fn()) {
    return render(
      <Fragment>
        <ConnectRepositoryModal
          Body={ModalBody}
          Footer={ModalFooter}
          Header={makeClosableHeader(jest.fn())}
          CloseButton={makeCloseButton(closeModal)}
          closeModal={closeModal}
          project={project}
        />
      </Fragment>,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      method: 'GET',
      body: {
        repos: [
          {
            name: 'getsentry/sentry',
            identifier: 'getsentry/sentry',
            externalId: '1',
            isInstalled: true,
            defaultBranch: 'main',
          },
          {
            name: 'getsentry/relay',
            identifier: 'getsentry/relay',
            externalId: '2',
            isInstalled: true,
            defaultBranch: 'master',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '10',
          name: 'getsentry/sentry',
          externalId: '1',
          integrationId: integration.id,
        }),
        RepositoryFixture({
          id: '11',
          name: 'getsentry/relay',
          externalId: '2',
          integrationId: integration.id,
        }),
      ],
    });
  });

  it('renders initial modal state', async () => {
    renderModal();
    expect(
      screen.getByText(`Connect a repository to ${project.slug}`)
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /project/i})).toBeDisabled();
    expect(
      await screen.findByText('Select a repository first to configure code paths')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    expect(
      screen.queryByRole('textbox', {name: /stack trace prefix/i})
    ).not.toBeInTheDocument();
  });

  it('shows the path list after selecting a repository and gates Save on path content', async () => {
    renderModal();

    await userEvent.click(screen.getByText('Search repositories'));
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('getsentry/relay')).toBeInTheDocument();
    await userEvent.click(screen.getByText('getsentry/sentry'));

    expect(
      screen.queryByText('Select a repository first to configure code paths')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /stack trace prefix/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();

    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'src/'
    );
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();

    await userEvent.type(
      screen.getByRole('textbox', {name: /repository prefix/i}),
      'app/'
    );
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('seeds the branch field with the repository default branch', async () => {
    renderModal();

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/relay'));

    expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('master');
  });

  it('supports adding another path inside the modal', async () => {
    renderModal();

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));

    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'src/'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: /repository prefix/i}),
      'app/'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

    expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /stack trace prefix/i})
    ).toBeInTheDocument();
  });

  it('persists the project repo and path mappings on save', async () => {
    const closeModal = jest.fn();
    const postRepo = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/repo/`,
      method: 'POST',
      body: {
        id: '99',
        projectId: project.id,
        repositoryId: '10',
        source: 'scm_onboarding',
        created: true,
      },
    });
    const postMapping = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      body: {},
    });

    renderModal(closeModal);

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(postRepo).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/repo/`,
        expect.objectContaining({
          method: 'POST',
          data: {repositoryId: '10'},
        })
      );
    });
    expect(postMapping).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/code-mappings/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          integrationId: integration.id,
          repositoryId: '10',
          projectId: project.id,
          stackRoot: '',
          sourceRoot: '',
          defaultBranch: 'main',
        }),
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('treats a duplicate mapping as success when this repo already owns it', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/repo/`,
      method: 'POST',
      body: {id: '99', projectId: project.id, repositoryId: '10', created: false},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      statusCode: 400,
      body: {
        nonFieldErrors: [
          'Code path config already exists with this project, stack trace root, and source root',
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [{repoId: '10', stackRoot: '', sourceRoot: ''}],
    });

    renderModal(closeModal);

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
  });

  it('shows an error when a duplicate mapping belongs to a different repo', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/repo/`,
      method: 'POST',
      body: {id: '99', projectId: project.id, repositoryId: '10', created: true},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      statusCode: 400,
      body: {
        nonFieldErrors: [
          'Code path config already exists with this project, stack trace root, and source root',
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      // repoId '11' (relay) owns the conflicting mapping, not '10' (sentry)
      body: [{repoId: '11', stackRoot: '', sourceRoot: ''}],
    });

    renderModal(closeModal);

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText(
        /Code path config already exists with this project, stack trace root, and source root/
      )
    ).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('shows an inline error and keeps the modal open when save fails', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/repo/`,
      method: 'POST',
      body: {
        id: '99',
        projectId: project.id,
        repositoryId: '10',
        source: 'scm_onboarding',
        created: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      statusCode: 400,
      body: {repositoryId: ['Repository does not exist']},
    });

    renderModal(closeModal);

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Repository does not exist')).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
