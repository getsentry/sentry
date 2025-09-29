import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';
import type {PreventAIOrg, PreventAIProvider} from 'sentry/views/prevent/preventAI/types';

describe('ManageReposToolbar', () => {
  const github: PreventAIProvider = 'github';
  const installedOrgs: PreventAIOrg[] = [
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
    const orgSelect = await screen.findByRole('button', {name: /Org One/i});
    const repoSelect = await screen.findByRole('button', {name: /Repo One/i});
    expect(orgSelect).toBeInTheDocument();
    expect(repoSelect).toBeInTheDocument();
  });

  it('shows the correct selected org and repo', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    // The triggers should show the selected org and repo names
    const orgTrigger = await screen.findByRole('button', {name: /Org One/i});
    const repoTrigger = await screen.findByRole('button', {name: /Repo One/i});
    expect(orgTrigger).toHaveTextContent('Org One');
    expect(repoTrigger).toHaveTextContent('Repo One');
  });

  it('calls onOrgChange when organization is changed', async () => {
    render(<ManageReposToolbar {...defaultProps} />);
    // Open the org select dropdown
    const orgTrigger = await screen.findByRole('button', {name: /Org One/i});
    await userEvent.click(orgTrigger);

    // Select the new org option
    const orgOption = await screen.findByText('Org Two');
    await userEvent.click(orgOption);

    expect(defaultProps.onOrgChange).toHaveBeenCalledWith('org-2');
  });

  it('calls onRepoChange when repository is changed', async () => {
    render(<ManageReposToolbar {...defaultProps} selectedRepo="repo-1" />);
    // Open the repo select dropdown
    const repoTrigger = await screen.findByRole('button', {name: /Repo One/i});
    await userEvent.click(repoTrigger);

    // Select the new repo option
    const repoOption = await screen.findByText('Repo Two');
    await userEvent.click(repoOption);

    expect(defaultProps.onRepoChange).toHaveBeenCalledWith('repo-2');
  });

  it('shows only repos for the selected org', async () => {
    render(
      <ManageReposToolbar {...defaultProps} selectedOrg="org-2" selectedRepo="repo-3" />
    );
    // Open the repo select dropdown
    const repoTrigger = await screen.findByRole('button', {name: /Repo Three/i});
    await userEvent.click(repoTrigger);

    // Find all repo options in the dropdown menu - only "Repo Three" should be present
    const repoOptions = await screen.findAllByText(/Repo/i);
    const repoOptionTexts = repoOptions.map(option => option.textContent);
    expect(repoOptionTexts).toContain('Repo Three');
    expect(repoOptionTexts).not.toContain('Repo One');
    expect(repoOptionTexts).not.toContain('Repo Two');
  });
});
