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
    expect(
      await screen.findByRole('heading', {name: /Manage Repositories/i})
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/Settings/i)).toBeInTheDocument();
  });

  it('shows the correct org and repo names in the toolbar', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    // Should show the first org and repo by default
    expect(await screen.findByText('Org One')).toBeInTheDocument();
    expect(await screen.findByText('Repo One')).toBeInTheDocument();
  });

  it('opens the settings panel when the settings button is clicked', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    expect(screen.queryByText(/Prevent AI Settings/i)).not.toBeInTheDocument();
    const settingsButton = await screen.findByLabelText(/Settings/i);
    await userEvent.click(settingsButton);
    expect(await screen.findByText(/Prevent AI Settings/i)).toBeInTheDocument();
  });

  it('switches org and repo when toolbar selection changes', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    const orgSelect = await screen.findByRole('combobox', {name: /Organization/i});
    await userEvent.click(orgSelect);
    const orgTwoOption = await screen.findByText('Org Two');
    await userEvent.click(orgTwoOption);

    // After changing org, repo should switch to the first repo of org-2
    expect(await screen.findByText('Org Two')).toBeInTheDocument();
    expect(await screen.findByText('Repo Three')).toBeInTheDocument();
  });

  it('renders the feature overview and external link', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    expect(
      await screen.findByText(/To install more repositories or uninstall the app/i)
    ).toBeInTheDocument();
    const link = await screen.findByRole('link', {name: /Seer by Sentry app/i});
    expect(link).toHaveAttribute('href', 'https://github.com/apps/seer-by-sentry');
  });

  it('renders the illustration image', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    const img = await screen.findByAltText(/Prevent PR Comments/i);
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('renders tooltip and disabled settings button if no org or repo is selected', async () => {
    render(<ManageReposPage installedOrgs={installedOrgs} />);
    const settingsButton = await screen.findByLabelText(/Settings/i);
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton).toBeDisabled();
    await userEvent.hover(settingsButton);
    expect(
      await screen.findByText(
        'Select an organization and repository to configure settings'
      )
    ).toBeInTheDocument();
  });
});
