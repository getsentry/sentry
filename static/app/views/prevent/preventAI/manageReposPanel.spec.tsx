import selectEvent from 'react-select-event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PreventAIOrgConfig} from 'sentry/types/prevent';
import ManageReposPanel, {
  getRepoConfig,
} from 'sentry/views/prevent/preventAI/manageReposPanel';

let mockUpdatePreventAIFeatureReturn: any = {};
jest.mock('sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature', () => ({
  useUpdatePreventAIFeature: () => ({
    enableFeature: jest.fn(),
    ...mockUpdatePreventAIFeatureReturn,
  }),
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
    MockApiClient.clearMockResponses();
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
    const mockOrganizationWithEnabledFeatures = OrganizationFixture({
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
              sensitivity: 'high',
            },
          },
          repo_overrides: {},
        },
      },
    });

    it('shows sensitivity dropdown for enabled vanilla feature', async () => {
      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganizationWithEnabledFeatures,
      });

      const dropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      expect(dropdown).toBeInTheDocument();

      // Check that the current value is displayed
      expect(screen.getByDisplayValue('High')).toBeInTheDocument();
    });

    it('shows sensitivity dropdown for enabled bug prediction feature', async () => {
      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganizationWithEnabledFeatures,
      });

      const dropdown = await screen.findByTestId('error-prediction-sensitivity-dropdown');
      expect(dropdown).toBeInTheDocument();

      // Check that the current value is displayed
      expect(screen.getByDisplayValue('Medium')).toBeInTheDocument();
    });

    it('does not show sensitivity dropdown when vanilla feature is disabled', async () => {
      const orgWithDisabledVanilla = OrganizationFixture({
        preventAiConfigGithub: {
          ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub,
          default_org_config: {
            ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub!
              .default_org_config,
            org_defaults: {
              ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub!
                .default_org_config.org_defaults,
              vanilla: {
                enabled: false,
                triggers: {on_command_phrase: false, on_ready_for_review: false},
                sensitivity: 'medium',
              },
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithDisabledVanilla,
      });

      expect(
        screen.queryByTestId('pr-review-sensitivity-dropdown')
      ).not.toBeInTheDocument();
    });

    it('does not show sensitivity dropdown when bug prediction feature is disabled', async () => {
      const orgWithDisabledBugPrediction = OrganizationFixture({
        preventAiConfigGithub: {
          ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub,
          default_org_config: {
            ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub!
              .default_org_config,
            org_defaults: {
              ...mockOrganizationWithEnabledFeatures.preventAiConfigGithub!
                .default_org_config.org_defaults,
              bug_prediction: {
                enabled: false,
                triggers: {on_command_phrase: false, on_ready_for_review: false},
                sensitivity: 'medium',
              },
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithDisabledBugPrediction,
      });

      expect(
        screen.queryByTestId('error-prediction-sensitivity-dropdown')
      ).not.toBeInTheDocument();
    });

    it('calls enableFeature with correct sensitivity when vanilla sensitivity is changed', async () => {
      const mockEnableFeature = jest.fn();
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: mockEnableFeature,
        isLoading: false,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganizationWithEnabledFeatures,
      });

      const dropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      await selectEvent.openMenu(dropdown);
      await selectEvent.select(dropdown, 'Low');

      await waitFor(() => {
        expect(mockEnableFeature).toHaveBeenCalledWith({
          feature: 'vanilla',
          enabled: true,
          orgName: 'org-1',
          repoName: 'repo-1',
          sensitivity: 'low',
        });
      });
    });

    it('calls enableFeature with correct sensitivity when bug prediction sensitivity is changed', async () => {
      const mockEnableFeature = jest.fn();
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: mockEnableFeature,
        isLoading: false,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganizationWithEnabledFeatures,
      });

      const dropdown = await screen.findByTestId('error-prediction-sensitivity-dropdown');
      await selectEvent.openMenu(dropdown);
      await selectEvent.select(dropdown, 'Critical');

      await waitFor(() => {
        expect(mockEnableFeature).toHaveBeenCalledWith({
          feature: 'bug_prediction',
          enabled: true,
          orgName: 'org-1',
          repoName: 'repo-1',
          sensitivity: 'critical',
        });
      });
    });

    it('disables sensitivity dropdowns when loading', async () => {
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: jest.fn(),
        isLoading: true,
      };

      render(<ManageReposPanel {...defaultProps} />, {
        organization: mockOrganizationWithEnabledFeatures,
      });

      const vanillaDropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      const bugPredictionDropdown = await screen.findByTestId(
        'error-prediction-sensitivity-dropdown'
      );

      expect(vanillaDropdown).toBeDisabled();
      expect(bugPredictionDropdown).toBeDisabled();
    });

    it('shows default sensitivity value when sensitivity is undefined', async () => {
      const orgWithUndefinedSensitivity = OrganizationFixture({
        preventAiConfigGithub: {
          schema_version: 'v1',
          github_organizations: {},
          default_org_config: {
            org_defaults: {
              bug_prediction: {
                enabled: true,
                triggers: {on_command_phrase: true, on_ready_for_review: false},
                // sensitivity is undefined
              },
              test_generation: {
                enabled: false,
                triggers: {on_command_phrase: false, on_ready_for_review: false},
              },
              vanilla: {
                enabled: true,
                triggers: {on_command_phrase: false, on_ready_for_review: false},
                // sensitivity is undefined
              },
            },
            repo_overrides: {},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {
        organization: orgWithUndefinedSensitivity,
      });

      // Should default to 'medium' when sensitivity is undefined
      const vanillaDropdown = await screen.findByTestId('pr-review-sensitivity-dropdown');
      const bugPredictionDropdown = await screen.findByTestId(
        'error-prediction-sensitivity-dropdown'
      );

      expect(vanillaDropdown).toHaveDisplayValue('Medium');
      expect(bugPredictionDropdown).toHaveDisplayValue('Medium');
    });
  });
});
