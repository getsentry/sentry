import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
    expect(await screen.findByLabelText(/PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Test Generation/i)).not.toBeChecked();
    expect(await screen.findByLabelText(/Error Prediction/i)).toBeChecked();
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
    expect(await screen.findByLabelText(/PR Review/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Test Generation/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Error Prediction/i)).toBeDisabled();
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
  });

  describe('Sensitivity Dropdowns', () => {
    it('renders sensitivity dropdown for PR Review when enabled', async () => {
      const enabledConfig = {
        ...mockOrganization.preventAiConfigGithub,
        default_org_config: {
          org_defaults: {
            ...mockOrganization.preventAiConfigGithub!.default_org_config.org_defaults,
            vanilla: {
              enabled: true,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
          },
          repo_overrides: {},
        },
      };

      const orgWithEnabledVanilla = {
        ...mockOrganization,
        preventAiConfigGithub: enabledConfig,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithEnabledVanilla,
      });

      expect(
        await screen.findByTestId('pr-review-sensitivity-dropdown')
      ).toBeInTheDocument();
    });

    it('does not render sensitivity dropdown for PR Review when disabled', async () => {
      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganization,
      });

      expect(
        screen.queryByTestId('pr-review-sensitivity-dropdown')
      ).not.toBeInTheDocument();
    });

    it('renders sensitivity dropdown for Error Prediction when enabled', async () => {
      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganization,
      });

      expect(
        await screen.findByTestId('error-prediction-sensitivity-dropdown')
      ).toBeInTheDocument();
    });

    it('does not render sensitivity dropdown for Error Prediction when disabled', async () => {
      const disabledConfig = {
        ...mockOrganization.preventAiConfigGithub,
        default_org_config: {
          org_defaults: {
            ...mockOrganization.preventAiConfigGithub!.default_org_config.org_defaults,
            bug_prediction: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
          },
          repo_overrides: {},
        },
      };

      const orgWithDisabledBugPrediction = {
        ...mockOrganization,
        preventAiConfigGithub: disabledConfig,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithDisabledBugPrediction,
      });

      expect(
        screen.queryByTestId('error-prediction-sensitivity-dropdown')
      ).not.toBeInTheDocument();
    });

    it('displays correct default sensitivity value for PR Review', async () => {
      const enabledConfig = {
        ...mockOrganization.preventAiConfigGithub,
        default_org_config: {
          org_defaults: {
            ...mockOrganization.preventAiConfigGithub!.default_org_config.org_defaults,
            vanilla: {
              enabled: true,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'high',
            },
          },
          repo_overrides: {},
        },
      };

      const orgWithHighSensitivity = {
        ...mockOrganization,
        preventAiConfigGithub: enabledConfig,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithHighSensitivity,
      });

      const dropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      expect(dropdown).toHaveTextContent('High');
    });

    it('displays correct default sensitivity value for Error Prediction', async () => {
      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganization,
      });

      const dropdown = await screen.findByTestId(
        'error-prediction-sensitivity-dropdown'
      );
      expect(dropdown).toHaveTextContent('Medium');
    });

    it('updates sensitivity when selecting a different option for PR Review', async () => {
      const mockEnableFeature = jest.fn().mockResolvedValue({});
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: mockEnableFeature,
        isLoading: false,
      };

      const enabledConfig = {
        ...mockOrganization.preventAiConfigGithub,
        default_org_config: {
          org_defaults: {
            ...mockOrganization.preventAiConfigGithub!.default_org_config.org_defaults,
            vanilla: {
              enabled: true,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
          },
          repo_overrides: {},
        },
      };

      const orgWithEnabledVanilla = {
        ...mockOrganization,
        preventAiConfigGithub: enabledConfig,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithEnabledVanilla,
      });

      const dropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      await userEvent.click(dropdown);

      const criticalOption = await screen.findByText('Critical');
      await userEvent.click(criticalOption);

      await waitFor(() => {
        expect(mockEnableFeature).toHaveBeenCalledWith({
          feature: 'vanilla',
          enabled: true,
          orgName: 'org-1',
          repoName: 'repo-1',
          sensitivity: 'critical',
        });
      });
    });

    it('updates sensitivity when selecting a different option for Error Prediction', async () => {
      const mockEnableFeature = jest.fn().mockResolvedValue({});
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: mockEnableFeature,
        isLoading: false,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganization,
      });

      const dropdown = await screen.findByTestId(
        'error-prediction-sensitivity-dropdown'
      );
      await userEvent.click(dropdown);

      const lowOption = await screen.findByText('Low');
      await userEvent.click(lowOption);

      await waitFor(() => {
        expect(mockEnableFeature).toHaveBeenCalledWith({
          feature: 'bug_prediction',
          enabled: true,
          orgName: 'org-1',
          repoName: 'repo-1',
          sensitivity: 'low',
        });
      });
    });

    it('disables sensitivity dropdown when loading', async () => {
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: jest.fn(),
        isLoading: true,
      };

      const enabledConfig = {
        ...mockOrganization.preventAiConfigGithub,
        default_org_config: {
          org_defaults: {
            ...mockOrganization.preventAiConfigGithub!.default_org_config.org_defaults,
            vanilla: {
              enabled: true,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
          },
          repo_overrides: {},
        },
      };

      const orgWithEnabledVanilla = {
        ...mockOrganization,
        preventAiConfigGithub: enabledConfig,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithEnabledVanilla,
      });

      const dropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      expect(dropdown.querySelector('button')).toBeDisabled();
    });

    it('disables sensitivity dropdown when user lacks permissions', async () => {
      const orgWithoutPerms = {
        ...mockOrganization,
        access: [],
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithoutPerms,
      });

      const dropdown = await screen.findByTestId(
        'error-prediction-sensitivity-dropdown'
      );
      expect(dropdown.querySelector('button')).toBeDisabled();
    });
  });
});
