import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PreventAIProvider} from 'sentry/types/prevent';

import ManageReposPage from './manageRepos';

describe('PreventAIManageRepos', () => {
  const github: PreventAIProvider = 'github';
  const installedOrgs = [
    {
      id: 'org-1',
      name: 'Org One',
      provider: github,
      repos: [
        {
          id: 'repo-1',
          name: 'Repo One',
          fullName: 'org-1/repo-1',
          url: 'https://github.com/org-1/repo-1',
        },
        {
          id: 'repo-2',
          name: 'Repo Two',
          fullName: 'org-1/repo-2',
          url: 'https://github.com/org-1/repo-2',
        },
      ],
    },
    {
      id: 'org-2',
      name: 'Org Two',
      provider: github,
      repos: [
        {
          id: 'repo-3',
          name: 'Repo Three',
          fullName: 'org-2/repo-3',
          url: 'https://github.com/org-2/repo-3',
        },
      ],
    },
  ];

  const organization = OrganizationFixture({
    preventAiConfigGithub: PreventAIConfigFixture(),
  });

  it('renders the Manage Repositories title and toolbar', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />, {organization});
    expect(await screen.findByTestId('manage-repos-title')).toBeInTheDocument();
    expect(await screen.findByTestId('manage-repos-settings-button')).toBeInTheDocument();
  });

  it('opens the settings panel when the settings button is clicked', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />, {organization});
    expect(screen.queryByText(/AI Code Review Settings/i)).not.toBeInTheDocument();
    const settingsButton = await screen.findByTestId('manage-repos-settings-button');
    await userEvent.click(settingsButton);
    expect(await screen.findByText(/AI Code Review Settings/i)).toBeInTheDocument();
  });

  it('renders the illustration image', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />, {organization});
    const img = await screen.findByTestId('manage-repos-illustration-image');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('starts with "All Repos" selected by default', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />, {organization});
    const repoButton = await screen.findByRole('button', {
      name: /All Repos \(Organization Defaults\)/i,
    });
    expect(repoButton).toBeInTheDocument();
  });

  it('shows organization defaults message in panel when "All Repos" is selected', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />, {organization});
    const settingsButton = await screen.findByTestId('manage-repos-settings-button');
    await userEvent.click(settingsButton);

    expect(
      await screen.findByText(
        'These settings apply as defaults to all repositories in this organization. Individual repositories can override these settings.'
      )
    ).toBeInTheDocument();
  });
});
