import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PreventAIProvider} from 'sentry/views/prevent/preventAI/types';

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

  it('renders the Manage Repositories title and toolbar', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    expect(await screen.findByTestId('manage-repos-title')).toBeInTheDocument();
    expect(await screen.findByTestId('manage-repos-settings-button')).toBeInTheDocument();
  });

  it('opens the settings panel when the settings button is clicked', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    expect(screen.queryByText(/AI Code Review Settings/i)).not.toBeInTheDocument();
    const settingsButton = await screen.findByTestId('manage-repos-settings-button');
    await userEvent.click(settingsButton);
    expect(await screen.findByText(/AI Code Review Settings/i)).toBeInTheDocument();
  });

  it('renders the illustration image', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    const img = await screen.findByTestId('manage-repos-illustration-image');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });
});
