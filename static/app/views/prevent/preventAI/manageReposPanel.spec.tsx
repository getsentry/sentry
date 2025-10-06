import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PreventAIOrgConfig} from 'sentry/types/prevent';
import ManageReposPanel, {
  getRepoConfig,
} from 'sentry/views/prevent/preventAI/manageReposPanel';

let mockUpdatePreventAIFeatureReturn: any = {};
jest.mock('sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature', () => ({
  useUpdatePreventAIFeature: () => mockUpdatePreventAIFeatureReturn,
}));

describe('ManageReposPanel', () => {
  const defaultProps = {
    collapsed: false,
    onClose: jest.fn(),
    repoName: 'repo-1',
    orgName: 'org-1',
    repoFullName: 'org-1/repo-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreventAIFeatureReturn = {};
  });

  const mockOrganization = OrganizationFixture({
    preventAiConfigGithub: {
      schema_version: 'v1',
      github_organizations: {},
      default_org_config: {
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
            sensitivity: 'medium',
          },
          test_generation: {
            enabled: false,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
          },
          vanilla: {
            enabled: true,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
            sensitivity: 'medium',
          },
        },
        repo_overrides: {},
      },
    },
  });

  it('renders the panel header and description with repo link', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByText('AI Code Review Settings')).toBeInTheDocument();
    expect(
      await screen.findByText(/These settings apply to the selected/i)
    ).toBeInTheDocument();
    const repoLink = await screen.findByRole('link', {name: /repo-1/i});
    expect(repoLink).toHaveAttribute('href', 'https://github.com/org-1/repo-1');
  });

  it('calls onClose when the close button is clicked', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    const closeButton = await screen.findByLabelText(/Close Settings/i);
    await userEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows feature toggles with correct initial state', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Enable Test Generation/i)).not.toBeChecked();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeChecked();
    expect(
      await screen.findByLabelText(/Auto Run on Opened Pull Requests/i)
    ).not.toBeChecked();
    expect(await screen.findByLabelText(/Run when mentioned/i)).toBeChecked();
  });

  it('disables toggles when loading', async () => {
    mockUpdatePreventAIFeatureReturn = {
      ...mockUpdatePreventAIFeatureReturn,
      isLoading: true,
    };
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Enable Test Generation/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeDisabled();
  });

  it('shows error message if updateError is present', async () => {
    mockUpdatePreventAIFeatureReturn = {
      enableFeature: jest.fn(),
      isLoading: false,
      error: 'Something went wrong',
    };
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByText(/Could not update settings/i)).toBeInTheDocument();
  });

  describe('getRepoConfig', () => {
    it('returns repo override config when present', () => {
      const orgConfig: PreventAIOrgConfig = {
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {on_command_phrase: true, on_ready_for_review: true},
          },
          test_generation: {
            enabled: false,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
          vanilla: {
            enabled: true,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
        },
        repo_overrides: {
          'repo-1': {
            bug_prediction: {
              enabled: false,
              triggers: {on_command_phrase: true, on_ready_for_review: false},
            },
            test_generation: {
              enabled: true,
              triggers: {on_command_phrase: true, on_ready_for_review: false},
            },
            vanilla: {
              enabled: false,
              triggers: {on_command_phrase: true, on_ready_for_review: false},
            },
          },
        },
      };
      const result = getRepoConfig(orgConfig, 'repo-1');
      expect(result).toEqual({
        doesUseOrgDefaults: false,
        repoConfig: {
          bug_prediction: {
            enabled: false,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
          test_generation: {
            enabled: true,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
          vanilla: {
            enabled: false,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
        },
      });
    });

    it('returns org defaults when repo override is not present', () => {
      const orgConfig: PreventAIOrgConfig = {
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {on_command_phrase: true, on_ready_for_review: false},
          },
          test_generation: {
            enabled: false,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
          },
          vanilla: {
            enabled: true,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
          },
        },
        repo_overrides: {},
      };
      const result = getRepoConfig(orgConfig, 'repo-2');
      expect(result).toEqual({
        doesUseOrgDefaults: true,
        repoConfig: orgConfig.org_defaults,
      });
    });
  });
});
