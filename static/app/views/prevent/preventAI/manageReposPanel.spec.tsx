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
    orgId: 'org-1',
    orgName: 'org-1',
    repoId: 'repo-1',
    repoName: 'repo-1',
    repoFullName: 'org-1/repo-1',
    isEditingOrgDefaults: false,
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

  it('calls onClose when the close button is clicked', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    const closeButton = await screen.findByLabelText(/Close Settings/i);
    await userEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders the panel header and description with repo link when repo is selected', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(
      await screen.findByText('AI Code Review Repository Settings')
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/These settings apply to the selected/i)
    ).toBeInTheDocument();
    const repoLink = await screen.findByRole('link', {name: /repo-1/i});
    expect(repoLink).toHaveAttribute('href', 'https://github.com/org-1/repo-1');
  });

  it('renders the panel header and description with org defaults when "All Repos" is selected', async () => {
    const props = {...defaultProps};
    props.repoId = '';
    props.repoName = '';
    props.isEditingOrgDefaults = true;
    render(<ManageReposPanel {...props} />, {organization: mockOrganization});
    expect(
      await screen.findByText('AI Code Review Default Settings')
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/These settings apply to all repositories by default/i)
    ).toBeInTheDocument();
  });

  it('renders [none] when no repos have overrides when editing org defaults', async () => {
    const props = {...defaultProps};
    props.repoId = '';
    props.repoName = '';
    props.isEditingOrgDefaults = true;
    const mockOrg = structuredClone(mockOrganization);
    mockOrg.preventAiConfigGithub!.default_org_config.repo_overrides = {};
    render(<ManageReposPanel {...props} />, {organization: mockOrg});
    expect(await screen.findByText(/\[none\]/i)).toBeInTheDocument();
  });

  it('shows feature toggles with correct initial state when repo has overrides', async () => {
    const defaultOrgConfig = mockOrganization.preventAiConfigGithub!.default_org_config;
    const orgWithOverride = OrganizationFixture({
      preventAiConfigGithub: {
        schema_version: 'v1',
        default_org_config: defaultOrgConfig,
        github_organizations: {
          'org-1': {
            org_defaults: defaultOrgConfig.org_defaults,
            repo_overrides: {
              'repo-1': defaultOrgConfig.org_defaults,
            },
          },
        },
      },
    });
    render(<ManageReposPanel {...defaultProps} />, {organization: orgWithOverride});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Enable Test Generation/i)).not.toBeChecked();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeChecked();
    expect(
      await screen.findByLabelText(/Auto Run on Opened Pull Requests/i)
    ).not.toBeChecked();
    expect(await screen.findByLabelText(/Run when mentioned/i)).toBeChecked();
  });

  it('disables toggles when loading and repo has overrides', async () => {
    mockUpdatePreventAIFeatureReturn = {
      ...mockUpdatePreventAIFeatureReturn,
      isLoading: true,
    };
    const defaultOrgConfig = mockOrganization.preventAiConfigGithub!.default_org_config;
    const orgWithOverride = OrganizationFixture({
      preventAiConfigGithub: {
        schema_version: 'v1',
        default_org_config: defaultOrgConfig,
        github_organizations: {
          'org-1': {
            org_defaults: defaultOrgConfig.org_defaults,
            repo_overrides: {
              'repo-1': defaultOrgConfig.org_defaults,
            },
          },
        },
      },
    });
    render(<ManageReposPanel {...defaultProps} />, {organization: orgWithOverride});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Enable Test Generation/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeDisabled();
  });

  it('hides all feature toggles when using org defaults', () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    // Repo is using org defaults, so all feature toggles should be hidden
    expect(screen.queryByLabelText(/Enable PR Review/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable Test Generation/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable Error Prediction/i)).not.toBeInTheDocument();
  });

  it('shows feature toggles when repo has overrides', async () => {
    const defaultOrgConfig = mockOrganization.preventAiConfigGithub!.default_org_config;
    const orgWithOverride = OrganizationFixture({
      preventAiConfigGithub: {
        schema_version: 'v1',
        default_org_config: defaultOrgConfig,
        github_organizations: {
          'org-1': {
            org_defaults: defaultOrgConfig.org_defaults,
            repo_overrides: {
              'repo-1': {
                bug_prediction: {
                  enabled: true,
                  triggers: {on_command_phrase: true, on_ready_for_review: false},
                  sensitivity: 'high',
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
            },
          },
        },
      },
    });
    render(<ManageReposPanel {...defaultProps} />, {organization: orgWithOverride});
    // Repo has overrides, so feature toggles should be enabled
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeEnabled();
    expect(await screen.findByLabelText(/Enable Test Generation/i)).toBeEnabled();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeEnabled();
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

  it('shows sensitivity options when feature is enabled and repo has overrides', async () => {
    const defaultOrgConfig = mockOrganization.preventAiConfigGithub!.default_org_config;
    const repoOverride = {...defaultOrgConfig.org_defaults};
    repoOverride.bug_prediction.sensitivity = 'high';

    const orgWithOverride = OrganizationFixture({
      preventAiConfigGithub: {
        schema_version: 'v1',
        default_org_config: defaultOrgConfig,
        github_organizations: {
          'org-1': {
            org_defaults: defaultOrgConfig.org_defaults,
            repo_overrides: {
              'repo-1': repoOverride,
            },
          },
        },
      },
    });
    render(<ManageReposPanel {...defaultProps} />, {organization: orgWithOverride});
    const prReviewCheckbox = await screen.findByLabelText(/Enable PR Review/i);
    const errorPredictionCheckbox = await screen.findByLabelText(
      /Enable Error Prediction/i
    );
    expect(prReviewCheckbox).toBeChecked();
    expect(errorPredictionCheckbox).toBeChecked();
    expect(
      await screen.findByTestId(/pr-review-sensitivity-dropdown/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(/error-prediction-sensitivity-dropdown/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(/error-prediction-sensitivity-dropdown/i)
    ).toHaveTextContent(/High/i);
  });

  it('shows toggle for overriding organization defaults', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByText('Override Organization Defaults')).toBeInTheDocument();
    expect(
      await screen.findByText(
        /When enabled, you can customize settings for this repository/i
      )
    ).toBeInTheDocument();
    const toggle = await screen.findByLabelText('Override Organization Defaults');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('calls enableFeature when toggle is clicked', async () => {
    const mockEnableFeature = jest.fn();
    mockUpdatePreventAIFeatureReturn = {
      enableFeature: mockEnableFeature,
      isLoading: false,
    };

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    const toggle = await screen.findByLabelText('Override Organization Defaults');
    await userEvent.click(toggle);

    expect(mockEnableFeature).toHaveBeenCalledWith({
      feature: 'use_org_defaults',
      enabled: false,
      orgId: 'org-1',
      repoId: 'repo-1',
    });
  });

  it('does not show toggle when editing organization defaults', async () => {
    render(
      <ManageReposPanel {...defaultProps} repoId="" repoName="" isEditingOrgDefaults />,
      {
        organization: mockOrganization,
      }
    );
    expect(
      await screen.findByText(/These settings apply to all repositories by default/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /repo-1/i})).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Override Organization Defaults')
    ).not.toBeInTheDocument();
  });

  it('toggle is checked when repo has custom overrides', () => {
    const defaultOrgConfig = mockOrganization.preventAiConfigGithub!.default_org_config;
    const orgWithOverride = OrganizationFixture({
      preventAiConfigGithub: {
        schema_version: 'v1',
        default_org_config: defaultOrgConfig,
        github_organizations: {
          'org-1': {
            org_defaults: defaultOrgConfig.org_defaults,
            repo_overrides: {
              'repo-1': {
                bug_prediction: {
                  enabled: false,
                  triggers: {on_command_phrase: false, on_ready_for_review: false},
                },
                test_generation: {
                  enabled: true,
                  triggers: {on_command_phrase: false, on_ready_for_review: false},
                },
                vanilla: {
                  enabled: false,
                  triggers: {on_command_phrase: false, on_ready_for_review: false},
                },
              },
            },
          },
        },
      },
    });
    render(<ManageReposPanel {...defaultProps} />, {organization: orgWithOverride});
    const toggle = screen.getByLabelText('Override Organization Defaults');
    expect(toggle).toBeChecked();
  });

  describe('getRepoConfig', () => {
    it('returns org defaults when repoName is null', () => {
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
        repo_overrides: {
          'repo-1': {
            bug_prediction: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
            },
            test_generation: {
              enabled: true,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
            },
            vanilla: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
            },
          },
        },
      };
      const result = getRepoConfig(orgConfig, '');
      expect(result).toEqual({
        doesUseOrgDefaults: true,
        repoConfig: orgConfig.org_defaults,
      });
    });

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
