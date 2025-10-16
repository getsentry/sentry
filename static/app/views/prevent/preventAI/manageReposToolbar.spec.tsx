import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PreventAIOrg, PreventAIProvider} from 'sentry/types/prevent';
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';

describe('ManageReposToolbar', () => {
  const github: PreventAIProvider = 'github';
  const installedOrgs: PreventAIOrg[] = [
    {
      id: '1',
      name: 'org-1',
      provider: github,
      repos: [
        {
          id: '1',
          name: 'repo-1',
          fullName: 'org-1/repo-1',
          url: 'https://github.com/org-1/repo-1',
        },
        {
          id: '2',
          name: 'repo-2',
          fullName: 'org-1/repo-2',
          url: 'https://github.com/org-1/repo-2',
        },
      ],
    },
    {
      id: '2',
      name: 'org-2',
      provider: github,
      repos: [
        {
          id: '3',
          name: 'repo-3',
          fullName: 'org-2/repo-3',
          url: 'https://github.com/org-2/repo-3',
        },
      ],
    },
  ];

  const defaultProps = {
    installedOrgs,
    selectedOrg: 'org-1',
    selectedRepo: 'repo-1',
    onOrgChange: jest.fn(),
    onRepoChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders organization and repository selectors', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    // Find the org and repo selects by their visible labels
    const orgSelect = await screen.findByRole('button', {name: /org-1/i});
    const repoSelect = await screen.findByRole('button', {name: /repo-1/i});
    expect(orgSelect).toBeInTheDocument();
    expect(repoSelect).toBeInTheDocument();
  });

  it('shows the correct selected org and repo', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    // The triggers should show the selected org and repo names
    const orgTrigger = await screen.findByRole('button', {name: /org-1/i});
    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    expect(orgTrigger).toHaveTextContent('org-1');
    expect(repoTrigger).toHaveTextContent('repo-1');
  });

  it('calls onOrgChange when organization is changed', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    // Open the org select dropdown
    const orgTrigger = await screen.findByRole('button', {name: /org-1/i});
    await userEvent.click(orgTrigger);

    // Select the new org option
    const orgOption = await screen.findByText('org-2');
    await userEvent.click(orgOption);

    expect(defaultProps.onOrgChange).toHaveBeenCalledWith('org-2');
  });

  it('calls onRepoChange when repository is changed', async () => {
    render(<ManageReposToolbar {...defaultProps} selectedRepo="repo-1" />);
    // Open the repo select dropdown
    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    // Select the new repo option
    const repoOption = await screen.findByText('repo-2');
    await userEvent.click(repoOption);

    expect(defaultProps.onRepoChange).toHaveBeenCalledWith('repo-2');
  });

  it('shows only repos for the selected org', async () => {
    render(
      <ManageReposToolbar {...defaultProps} selectedOrg="org-2" selectedRepo="repo-3" />
    );
    // Open the repo select dropdown
    const repoTrigger = await screen.findByRole('button', {name: /repo-3/i});
    await userEvent.click(repoTrigger);

    // Find all repo options in the dropdown menu - only "Repo Three" should be present
    const repoOptions = await screen.findAllByText(/repo-/i);
    const repoOptionTexts = repoOptions.map(option => option.textContent);
    expect(repoOptionTexts).toContain('repo-3');
    expect(repoOptionTexts).not.toContain('repo-1');
    expect(repoOptionTexts).not.toContain('repo-2');
  });

  it('shows "All Repos" option at the top of repository dropdown', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    expect(await screen.findByText('All Repos')).toBeInTheDocument();
  });

  it('calls onRepoChange with "__ALL_REPOS__" when "All Repos" is selected', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    const allReposOption = await screen.findByText('All Repos');
    await userEvent.click(allReposOption);

    expect(defaultProps.onRepoChange).toHaveBeenCalledWith('__ALL_REPOS__');
  });
});
