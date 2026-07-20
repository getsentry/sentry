import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {ProjectAddRepoModal} from 'sentry/components/seer/projectAddRepoModal/projectAddRepoModal';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {NON_GITHUB_HANDOFF_WARNING} from 'sentry/utils/seer/preferredAgent';

describe('ProjectAddRepoModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  function mockEndpoints() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '1',
          name: 'getsentry/sentry',
          externalId: '101',
          provider: {id: 'integrations:github', name: 'GitHub'},
          integrationId: '201',
        }),
        RepositoryFixture({
          id: '3',
          name: 'getsentry/gitlab-repo',
          externalId: '103',
          provider: {id: 'integrations:gitlab', name: 'GitLab'},
          integrationId: '203',
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [{id: '123', provider: 'cursor', name: 'Cursor Cloud Agent'}],
      },
    });
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    mockEndpoints();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  function openAddRepoModal(org = organization) {
    renderGlobalModal({organization: org});
    act(() => {
      openModal(modalProps => (
        <ProjectAddRepoModal {...modalProps} title="Add Project to Autofix" />
      ));
    });
  }

  async function addRepository(name: RegExp) {
    await userEvent.click(await screen.findByRole('button', {name: 'Add Repository'}));
    await userEvent.click(await screen.findByRole('option', {name}));
  }

  it('keeps the agent dropdown enabled for a GitHub repo', async () => {
    openAddRepoModal();

    expect(await screen.findByRole('textbox', {name: 'Handoff to Agent'})).toBeEnabled();

    await addRepository(/getsentry\/sentry/);

    expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeEnabled();
    expect(screen.queryByText(NON_GITHUB_HANDOFF_WARNING)).not.toBeInTheDocument();
  });

  it('disables the agent dropdown and warns when a GitLab repo is added', async () => {
    openAddRepoModal();

    await addRepository(/gitlab-repo/);

    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeDisabled()
    );
    expect(screen.getByText(NON_GITHUB_HANDOFF_WARNING)).toBeInTheDocument();
  });

  async function selectCodingAgent() {
    await userEvent.click(screen.getByRole('textbox', {name: 'Handoff to Agent'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );
  }

  it('hard-resets a chosen coding agent to Seer and keeps it on removal', async () => {
    openAddRepoModal();

    // The user picks a coding agent.
    await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await selectCodingAgent();
    expect(screen.getByText('Cursor Cloud Agent')).toBeInTheDocument();

    // Adding a GitLab repo forces the selection to Seer and disables it.
    await addRepository(/gitlab-repo/);
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeDisabled()
    );
    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.queryByText('Cursor Cloud Agent')).not.toBeInTheDocument();

    // Removing the repo re-enables the dropdown, but the choice stays Seer — the
    // prior coding-agent selection is not restored (hard reset).
    await userEvent.click(screen.getByRole('button', {name: 'Remove repository'}));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeEnabled()
    );
    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.queryByText('Cursor Cloud Agent')).not.toBeInTheDocument();
    expect(screen.queryByText(NON_GITHUB_HANDOFF_WARNING)).not.toBeInTheDocument();
  });

  it('saves Seer as the agent when a GitLab repo is attached', async () => {
    const reposPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
    });
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      body: {},
    });

    openAddRepoModal();

    // Pick the project and a coding agent that the GitLab repo must override.
    await userEvent.click(await screen.findByRole('button', {name: 'Select Project'}));
    await userEvent.click(await screen.findByRole('option', {name: /project-slug/}));
    await selectCodingAgent();

    await addRepository(/gitlab-repo/);
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeDisabled()
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save Project'}));

    await waitFor(() => expect(reposPut).toHaveBeenCalled());
    expect(settingsPut).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      expect.objectContaining({data: expect.objectContaining({agent: 'seer'})})
    );
    // The reset must not carry the coding-agent integration id either.
    expect(settingsPut).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: expect.objectContaining({integrationId: '123'})})
    );
  });
});
