import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';

import AutofixRepositories from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';

describe('AutofixRepositoriesList', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const defaultPreference: ProjectSeerPreferences = {
    repositories: [],
    automated_run_stopping_point: undefined,
    automation_handoff: undefined,
  };

  it('renders empty state when no repositories are configured', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });

    render(
      <AutofixRepositories canWrite preference={defaultPreference} project={project} />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Get the most out of Seer')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Add Repositories to Project'})
    ).toBeInTheDocument();
  });

  it('renders the list of configured repositories', async () => {
    const existingRepo = {
      organization_id: organization.id,
      external_id: 'ext-1',
      name: 'my-repo',
      owner: 'my-org',
      provider: 'github',
      integration_id: '123',
      branch_name: 'main',
      instructions: '',
      branch_overrides: [],
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          externalId: 'ext-1',
          name: 'my-org/my-repo',
          provider: {id: 'github', name: 'GitHub'},
        }),
      ],
    });

    render(
      <AutofixRepositories
        canWrite
        preference={{...defaultPreference, repositories: [existingRepo]}}
        project={project}
      />,
      {organization}
    );

    expect(await screen.findByText('my-repo')).toBeInTheDocument();
  });

  it('preserves existing repository settings when saving from modal', async () => {
    const existingRepo = {
      organization_id: organization.id,
      external_id: 'ext-1',
      name: 'my-repo',
      owner: 'my-org',
      provider: 'github',
      integration_id: '123',
      branch_name: 'develop',
      instructions: 'Custom instructions',
      branch_overrides: [{tag_name: 'env', tag_value: 'prod', branch_name: 'release'}],
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          externalId: 'ext-1',
          name: 'my-org/my-repo',
          provider: {id: 'github', name: 'GitHub'},
          integrationId: '123',
        }),
        RepositoryFixture({
          id: '2',
          externalId: 'ext-2',
          name: 'other-org/other-repo',
          provider: {id: 'github', name: 'GitHub'},
          integrationId: '456',
        }),
      ],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      body: {},
    });

    render(
      <AutofixRepositories
        canWrite
        preference={{...defaultPreference, repositories: [existingRepo]}}
        project={project}
      />,
      {organization}
    );

    // Wait for the list to load
    expect(await screen.findByText('my-repo')).toBeInTheDocument();

    // Click the add button to open the modal
    await userEvent.click(
      screen.getByRole('button', {name: 'Add Repositories to Project'})
    );

    // Wait for modal to appear and find the new repo checkbox
    const newRepoCheckbox = await screen.findByRole('checkbox', {
      name: 'other-org/other-repo',
    });
    await userEvent.click(newRepoCheckbox);

    // Click the add button in the modal
    await userEvent.click(screen.getByRole('button', {name: 'Add 1 Repository'}));

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: expect.arrayContaining([
              // Existing repo should preserve all settings
              expect.objectContaining({
                external_id: 'ext-1',
                name: 'my-repo',
                owner: 'my-org',
                branch_name: 'develop',
                instructions: 'Custom instructions',
                branch_overrides: [
                  {tag_name: 'env', tag_value: 'prod', branch_name: 'release'},
                ],
              }),
              // New repo should have defaults
              expect.objectContaining({
                external_id: 'ext-2',
                name: 'other-repo',
                owner: 'other-org',
                provider: 'github',
                integration_id: '456',
                branch_name: '',
                instructions: '',
                branch_overrides: [],
              }),
            ]),
          }),
        })
      );
    });
  });

  it('creates new repository entry with defaults when adding a repo not in preferences', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          externalId: 'ext-new',
          name: 'new-org/new-repo',
          provider: {id: 'gitlab', name: 'GitLab'},
          integrationId: '789',
        }),
      ],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      body: {},
    });

    render(
      <AutofixRepositories canWrite preference={defaultPreference} project={project} />,
      {organization}
    );

    // Click the add button to open the modal (empty state version)
    const addButton = await screen.findByRole('button', {
      name: 'Add Repositories to Project',
    });
    await userEvent.click(addButton);

    // Wait for modal and select the repo
    const repoCheckbox = await screen.findByRole('checkbox', {name: 'new-org/new-repo'});
    await userEvent.click(repoCheckbox);

    // Save
    await userEvent.click(screen.getByRole('button', {name: 'Add 1 Repository'}));

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: [
              expect.objectContaining({
                organization_id: organization.id,
                external_id: 'ext-new',
                name: 'new-repo',
                owner: 'new-org',
                provider: 'gitlab',
                integration_id: '789',
                branch_name: '',
                instructions: '',
                branch_overrides: [],
              }),
            ],
          }),
        })
      );
    });
  });

  it('handles repository names without owner prefix', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          externalId: 'ext-simple',
          name: 'simple-repo-no-owner',
          provider: {id: 'github', name: 'GitHub'},
          integrationId: '111',
        }),
      ],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      body: {},
    });

    render(
      <AutofixRepositories canWrite preference={defaultPreference} project={project} />,
      {organization}
    );

    const addButton = await screen.findByRole('button', {
      name: 'Add Repositories to Project',
    });
    await userEvent.click(addButton);

    const repoCheckbox = await screen.findByRole('checkbox', {
      name: 'simple-repo-no-owner',
    });
    await userEvent.click(repoCheckbox);

    await userEvent.click(screen.getByRole('button', {name: 'Add 1 Repository'}));

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: [
              expect.objectContaining({
                external_id: 'ext-simple',
                // When name has no '/', split creates ['simple-repo-no-owner', undefined]
                // so owner gets 'simple-repo-no-owner' and name gets the original repo name
                name: expect.any(String),
                owner: 'simple-repo-no-owner',
              }),
            ],
          }),
        })
      );
    });
  });

  it('removes a repository when delete is confirmed', async () => {
    const repo1 = {
      organization_id: organization.id,
      external_id: 'ext-1',
      name: 'repo-1',
      owner: 'org',
      provider: 'github',
      integration_id: '123',
      branch_name: '',
      instructions: '',
      branch_overrides: [],
    };
    const repo2 = {
      organization_id: organization.id,
      external_id: 'ext-2',
      name: 'repo-2',
      owner: 'org',
      provider: 'github',
      integration_id: '456',
      branch_name: '',
      instructions: '',
      branch_overrides: [],
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      body: {},
    });

    render(
      <AutofixRepositories
        canWrite
        preference={{...defaultPreference, repositories: [repo1, repo2]}}
        project={project}
      />,
      {organization}
    );

    // Wait for repos to render
    expect(await screen.findByText('repo-1')).toBeInTheDocument();
    expect(screen.getByText('repo-2')).toBeInTheDocument();

    // Click delete on first repo
    const deleteButtons = screen.getAllByRole('button', {name: 'Disconnect Repository'});
    await userEvent.click(deleteButtons[0]!);

    // Confirm deletion
    await userEvent.click(await screen.findByRole('button', {name: /Disconnect/}));

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: [expect.objectContaining({external_id: 'ext-2'})],
          }),
        })
      );
    });
  });

  it('disables add button when canWrite is false', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });

    render(
      <AutofixRepositories
        canWrite={false}
        preference={defaultPreference}
        project={project}
      />,
      {organization}
    );

    const addButton = await screen.findByRole('button', {
      name: 'Add Repositories to Project',
    });
    expect(addButton).toBeDisabled();
  });
});
