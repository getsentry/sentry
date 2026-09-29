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

import {ConnectRepositoryModal} from 'sentry/components/connectRepository/connectRepositoryModal';

describe('ConnectRepositoryModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();

  const defaultEditRepo = {
    repositoryId: '10',
    repoName: 'getsentry/sentry',
    providerKey: 'github' as const,
    integrationId: integration.id,
    externalId: '1',
  };

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
          mode="connect"
        />
      </Fragment>,
      {organization}
    );
  }

  function renderEditModal(closeModal = jest.fn(), editRepo = defaultEditRepo) {
    return render(
      <Fragment>
        <ConnectRepositoryModal
          Body={ModalBody}
          Footer={ModalFooter}
          Header={makeClosableHeader(jest.fn())}
          CloseButton={makeCloseButton(closeModal)}
          closeModal={closeModal}
          project={project}
          mode="edit"
          repositoryId={editRepo.repositoryId}
          repoName={editRepo.repoName}
          providerKey={editRepo.providerKey}
          integrationId={editRepo.integrationId}
          externalId={editRepo.externalId}
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
    expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();

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

  it('disables Save only when both stack root and source root match', async () => {
    renderModal();

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));

    // Fill first mapping: src/ → app/
    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'src/'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: /repository prefix/i}),
      'app/'
    );

    // Add a second mapping: src/app/ → dist/  (prefix overlap — Save still enabled)
    await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'src/app/'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: /repository prefix/i}),
      'dist/'
    );
    expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();

    // Change second stack root to src/ — same stack, different source root (sameStack warning)
    // → Save stays enabled because the pair src/+dist/ is distinct from src/+app/
    await userEvent.clear(screen.getByRole('textbox', {name: /stack trace prefix/i}));
    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'src/'
    );
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();

    // Now make source roots identical too → exact duplicate → Save disabled
    await userEvent.clear(screen.getByRole('textbox', {name: /repository prefix/i}));
    await userEvent.type(
      screen.getByRole('textbox', {name: /repository prefix/i}),
      'app/'
    );
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
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
      body: {detail: 'Repository does not exist'},
    });

    renderModal(closeModal);

    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Repository does not exist')).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });

  describe('edit mode', () => {
    const seededMapping = {
      id: '5',
      repoId: '10',
      repoName: 'getsentry/sentry',
      projectId: project.id,
      stackRoot: 'src/',
      sourceRoot: 'app/',
      defaultBranch: 'main',
      integrationId: integration.id,
      hasCodeOwner: false,
    };

    const secondMapping = {
      id: '6',
      repoId: '10',
      repoName: 'getsentry/sentry',
      projectId: project.id,
      stackRoot: 'vendor/',
      sourceRoot: 'lib/',
      defaultBranch: 'main',
      integrationId: integration.id,
      hasCodeOwner: false,
    };

    it('shows locked project and repository fields with seeded rows, Save enabled', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [seededMapping],
      });

      renderEditModal();

      expect(screen.getByText('Edit code mappings')).toBeInTheDocument();
      // Both selects are disabled in edit mode.
      const [projectSelect, repoSelect] = screen.getAllByRole('textbox');
      expect(projectSelect).toBeDisabled();
      expect(repoSelect).toBeDisabled();

      // Seeded row becomes visible after the query resolves.
      expect(await screen.findByText('src/')).toBeInTheDocument();
      expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
    });

    it('POSTs new mappings, PUTs changed mappings, and DELETEs removed mappings on save', async () => {
      const closeModal = jest.fn();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [seededMapping, secondMapping],
      });
      const deleteMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${seededMapping.id}/`,
        method: 'DELETE',
        body: {},
      });
      const putMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${secondMapping.id}/`,
        method: 'PUT',
        body: {},
      });
      const postMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'POST',
        body: {},
      });

      renderEditModal(closeModal);

      // Wait for both seeded rows to appear.
      expect(await screen.findByText('vendor/')).toBeInTheDocument();

      // Delete the first seeded row (src/→app/).
      const deleteButtons = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(deleteButtons[0]!);

      // Expand and edit the remaining row (vendor/) to change its stack root.
      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));
      await userEvent.clear(screen.getByRole('textbox', {name: /stack trace prefix/i}));
      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'vendor/updated/'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Collapse path mapping'}));

      // Add a brand-new mapping (no id → POST).
      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(deleteMapping).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/code-mappings/${seededMapping.id}/`,
          expect.objectContaining({method: 'DELETE'})
        );
        expect(putMapping).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/code-mappings/${secondMapping.id}/`,
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({stackRoot: 'vendor/updated/'}),
          })
        );
        expect(postMapping).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/code-mappings/`,
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({stackRoot: 'src/'}),
          })
        );
      });
      expect(closeModal).toHaveBeenCalled();
    });

    it('locks protected mappings: delete disabled, prefixes disabled, branch enabled, alert shown', async () => {
      const protectedMapping = {...seededMapping, hasCodeOwner: true};
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [protectedMapping, secondMapping],
      });

      renderEditModal();

      expect(await screen.findByText('src/')).toBeInTheDocument();

      // Delete is disabled before expanding (scraps Button uses aria-disabled).
      const [deleteProtected] = screen.getAllByRole('button', {
        name: 'Delete path mapping',
      });
      expect(deleteProtected).toHaveAttribute('aria-disabled', 'true');

      // No alert until the row is expanded.
      expect(screen.queryByText(/Code Owners/)).not.toBeInTheDocument();

      const [expandProtected] = screen.getAllByRole('button', {
        name: 'Expand path mapping',
      });
      await userEvent.click(expandProtected!);

      // Alert with link is shown.
      expect(screen.getByRole('link', {name: 'Code Owners'})).toBeInTheDocument();
      expect(
        screen.getByText(/Remove the Code Owners connection before editing/)
      ).toBeInTheDocument();

      // Both prefix inputs are disabled; branch is still editable.
      const stackInput = screen.getByRole('textbox', {name: /stack trace prefix/i});
      const sourceInput = screen.getByRole('textbox', {name: /repository prefix/i});
      const branchInput = screen.getByRole('textbox', {name: /branch/i});
      expect(stackInput).toBeDisabled();
      expect(sourceInput).toBeDisabled();
      expect(branchInput).not.toBeDisabled();
    });

    it('seeds new mappings with the repository default branch', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [],
      });

      // No existing mappings, so the form fetches integrations repos by externalId.
      renderEditModal(jest.fn(), {
        repositoryId: '11',
        repoName: 'getsentry/relay',
        providerKey: 'github',
        integrationId: integration.id,
        externalId: '2',
      });

      expect(await screen.findByRole('textbox', {name: /branch/i})).toHaveValue('master');
    });

    it('POSTs with the repo integration id when the connected repo has no mappings', async () => {
      const closeModal = jest.fn();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [],
      });
      const postMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'POST',
        body: {},
      });

      renderEditModal(closeModal);

      expect(
        await screen.findByRole('textbox', {name: /stack trace prefix/i})
      ).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(postMapping).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/code-mappings/`,
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              integrationId: integration.id,
              repositoryId: '10',
            }),
          })
        );
      });
      expect(closeModal).toHaveBeenCalled();
    });

    it('does not PUT when the only difference is a null server branch displayed as main', async () => {
      const closeModal = jest.fn();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [{...seededMapping, defaultBranch: null}],
      });
      const putMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${seededMapping.id}/`,
        method: 'PUT',
        body: {},
      });

      renderEditModal(closeModal);

      expect(await screen.findByText('src/')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => expect(closeModal).toHaveBeenCalled());
      expect(putMapping).not.toHaveBeenCalled();
    });

    it('treats a 404 DELETE on retry as success after a later PUT failed', async () => {
      const closeModal = jest.fn();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/`,
        method: 'GET',
        body: [seededMapping, secondMapping],
      });
      const deleteMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${seededMapping.id}/`,
        method: 'DELETE',
        body: {},
      });
      const putMapping = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${secondMapping.id}/`,
        method: 'PUT',
        statusCode: 400,
        body: {detail: 'Failed to update mapping'},
      });

      renderEditModal(closeModal);

      expect(await screen.findByText('vendor/')).toBeInTheDocument();
      const [deleteFirst] = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(deleteFirst!);

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));
      await userEvent.clear(screen.getByRole('textbox', {name: /stack trace prefix/i}));
      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'vendor/updated/'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));
      expect(await screen.findByText('Failed to update mapping')).toBeInTheDocument();
      expect(deleteMapping).toHaveBeenCalled();
      expect(putMapping).toHaveBeenCalled();
      expect(closeModal).not.toHaveBeenCalled();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${seededMapping.id}/`,
        method: 'DELETE',
        statusCode: 404,
        body: {},
      });
      const retryPut = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/code-mappings/${secondMapping.id}/`,
        method: 'PUT',
        body: {},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => expect(closeModal).toHaveBeenCalled());
      expect(retryPut).toHaveBeenCalled();
    });
  });

  describe('repo-locked mode (lockedSide="repo")', () => {
    const repo = RepositoryFixture({
      id: '10',
      name: 'getsentry/sentry',
      externalId: '1',
      integrationId: integration.id,
    });

    const repoIdentity = {
      repositoryId: repo.id,
      repoName: repo.name,
      providerKey: 'github' as const,
      integrationId: integration.id,
      externalId: repo.externalId,
    };

    function renderRepoLockedConnect(closeModal = jest.fn()) {
      return render(
        <Fragment>
          <ConnectRepositoryModal
            Body={ModalBody}
            Footer={ModalFooter}
            Header={makeClosableHeader(jest.fn())}
            CloseButton={makeCloseButton(closeModal)}
            closeModal={closeModal}
            lockedSide="repo"
            mode="connect"
            {...repoIdentity}
          />
        </Fragment>,
        {organization}
      );
    }

    function renderRepoLockedEdit(closeModal = jest.fn()) {
      return render(
        <Fragment>
          <ConnectRepositoryModal
            Body={ModalBody}
            Footer={ModalFooter}
            Header={makeClosableHeader(jest.fn())}
            CloseButton={makeCloseButton(closeModal)}
            closeModal={closeModal}
            lockedSide="repo"
            mode="edit"
            {...repoIdentity}
          />
        </Fragment>,
        {organization}
      );
    }

    describe('connect', () => {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/projects/`,
          body: [project],
        });
        // Branch lookup for the locked repo (no existing mappings).
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
          body: {
            repos: [
              {
                name: repo.name,
                identifier: repo.name,
                externalId: repo.externalId,
                isInstalled: true,
                defaultBranch: 'main',
              },
            ],
          },
        });
      });

      it('renders with repository locked and a project selector', async () => {
        renderRepoLockedConnect();

        expect(
          await screen.findByText('Connect a project to getsentry/sentry')
        ).toBeInTheDocument();
        // Repository field is locked (disabled).
        expect(screen.getByRole('textbox', {name: /repository/i})).toBeDisabled();
        // Paths placeholder until a project is chosen.
        expect(
          await screen.findByText('Select a project first to configure code paths')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
      });

      it('shows the path list after selecting a project', async () => {
        renderRepoLockedConnect();

        await userEvent.click(await screen.findByText('Search projects'));
        await userEvent.click(await screen.findByText(project.slug));

        expect(
          screen.queryByText('Select a project first to configure code paths')
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole('textbox', {name: /stack trace prefix/i})
        ).toBeInTheDocument();
        expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
      });

      it('POSTs the repo link and code mapping on save', async () => {
        const closeModal = jest.fn();
        const postRepo = MockApiClient.addMockResponse({
          url: `/projects/${organization.slug}/${project.slug}/repo/`,
          method: 'POST',
          body: {id: '99', projectId: project.id, repositoryId: repo.id, source: 'scm_onboarding', created: true},
        });
        const postMapping = MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/code-mappings/`,
          method: 'POST',
          body: {},
        });

        renderRepoLockedConnect(closeModal);

        await userEvent.click(await screen.findByText('Search projects'));
        await userEvent.click(await screen.findByText(project.slug));
        expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() =>
          expect(postRepo).toHaveBeenCalledWith(
            `/projects/${organization.slug}/${project.slug}/repo/`,
            expect.objectContaining({method: 'POST', data: {repositoryId: repo.id}})
          )
        );
        expect(postMapping).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/code-mappings/`,
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              integrationId: integration.id,
              repositoryId: repo.id,
              projectId: project.id,
              defaultBranch: 'main',
            }),
          })
        );
        expect(closeModal).toHaveBeenCalled();
      });
    });

    describe('edit', () => {
      const seededMapping = {
        id: '5',
        repoId: repo.id,
        repoName: repo.name,
        projectId: project.id,
        projectSlug: project.slug,
        stackRoot: 'src/',
        sourceRoot: 'app/',
        defaultBranch: 'main',
        integrationId: integration.id,
        hasCodeOwner: false,
      };

      beforeEach(() => {
        // The repo-locked edit form reads org code-mappings to discover which
        // projects are already connected to this repo.
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/code-mappings/`,
          body: [seededMapping],
        });
        // Per-project code-mappings query used to seed path rows.
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/code-mappings/`,
          body: [seededMapping],
          match: [MockApiClient.matchQuery({project: project.id})],
        });
      });

      it('auto-selects the only mapped project and shows seeded paths', async () => {
        renderRepoLockedEdit();

        // Repository is locked; project is auto-selected.
        expect(screen.getByRole('textbox', {name: /repository/i})).toBeDisabled();
        expect(await screen.findByText('src/')).toBeInTheDocument();
        expect(await screen.findByRole('button', {name: 'Save'})).toBeEnabled();
      });

      it('project selector is limited to mapped projects', async () => {
        renderRepoLockedEdit();

        // The auto-selected project slug is visible as the select label.
        // Only mapped projects are available; none other should appear.
        expect(await screen.findByText(project.slug)).toBeInTheDocument();
      });
    });
  });
});
