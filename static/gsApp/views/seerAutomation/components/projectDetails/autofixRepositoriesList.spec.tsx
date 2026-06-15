import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {
  ProjectSeerPreferences,
  SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';

import {AutofixRepositories} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';

describe('AutofixRepositories (project details)', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  // SeerRepoDefinition carries external_id; the new repos endpoint is keyed by
  // the internal repository id, so the component resolves external_id against
  // the org repo list to build the `repositoryId` payload.
  const repoA: SeerRepoDefinition = {
    external_id: '101',
    name: 'sentry',
    owner: 'getsentry',
    provider: 'github',
    branch_name: '',
    instructions: '',
    branch_overrides: [],
  };
  const repoB: SeerRepoDefinition = {
    external_id: '102',
    name: 'seer',
    owner: 'getsentry',
    provider: 'github',
    branch_name: '',
    instructions: '',
    branch_overrides: [],
  };

  const preference: ProjectSeerPreferences = {
    repositories: [repoA, repoB],
    automated_run_stopping_point: 'solution',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [
        RepositoryFixture({id: '1', externalId: '101', name: 'getsentry/sentry'}),
        RepositoryFixture({id: '2', externalId: '102', name: 'getsentry/seer'}),
      ],
    });
  });

  it('removes a repository through the seer/repos/ endpoint keyed by repositoryId', async () => {
    const seerReposPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });

    render(<AutofixRepositories canWrite preference={preference} project={project} />, {
      organization,
    });
    renderGlobalModal();

    // Disconnect the second repo (getsentry/seer); the first remains.
    const disconnectButtons = await screen.findAllByRole('button', {
      name: 'Disconnect Repository',
    });
    await userEvent.click(disconnectButtons[1]!);
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(seerReposPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {
            repos: [
              {
                repositoryId: 1,
                branchName: null,
                instructions: null,
                branchOverrides: [],
              },
            ],
          },
        })
      );
    });
  });

  it('updating a working branch writes through the seer/repos/ endpoint', async () => {
    const seerReposPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });

    render(<AutofixRepositories canWrite preference={preference} project={project} />, {
      organization,
    });

    // Expand the first repo row (the chevron button is labelled "Expand") to
    // reveal the working-branch input.
    const expandButtons = await screen.findAllByRole('button', {name: 'Expand'});
    await userEvent.click(expandButtons[0]!);
    await userEvent.type(screen.getByPlaceholderText('Default branch'), 'm');

    await waitFor(() => {
      expect(seerReposPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {
            repos: [
              {repositoryId: 1, branchName: 'm', instructions: null, branchOverrides: []},
              {
                repositoryId: 2,
                branchName: null,
                instructions: null,
                branchOverrides: [],
              },
            ],
          },
        })
      );
    });
  });

  it('does not write through the legacy preferences endpoint', async () => {
    const preferencesPost = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });

    render(<AutofixRepositories canWrite preference={preference} project={project} />, {
      organization,
    });
    renderGlobalModal();

    const disconnectButtons = await screen.findAllByRole('button', {
      name: 'Disconnect Repository',
    });
    await userEvent.click(disconnectButtons[0]!);
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(preferencesPost).not.toHaveBeenCalled();
    });
  });
});
