import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {RepositoryStatus} from 'sentry/types/integrations';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import type {PreventAIConfig, PreventAIFeatureTriggers} from 'sentry/types/prevent';
import {PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT} from 'sentry/types/prevent';
import ManageReposPanel, {
  getRepoConfig,
  type ManageReposPanelProps,
} from 'sentry/views/prevent/preventAI/manageReposPanel';

let mockUpdatePreventAIFeatureReturn: any = {};
jest.mock('sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature', () => ({
  useUpdatePreventAIFeature: () => mockUpdatePreventAIFeatureReturn,
}));

describe('ManageReposPanel', () => {
  const mockOrg: OrganizationIntegration = {
    id: '1',
    name: 'org-1',
    externalId: 'org-1',
    provider: {
      key: 'github',
      name: 'GitHub',
      slug: 'github',
      aspects: {},
      canAdd: true,
      canDisable: false,
      features: [],
    },
    organizationId: '1',
    status: 'active',
    domainName: null,
    accountType: null,
    configData: null,
    configOrganization: [],
    gracePeriodEnd: null,
    icon: null,
    organizationIntegrationStatus: 'active',
  };

  const mockRepo: Repository = {
    id: 'repo-1',
    name: 'org-1/repo-1',
    url: 'https://github.com/org-1/repo-1',
    provider: {
      id: 'integrations:github',
      name: 'GitHub',
    },
    status: RepositoryStatus.ACTIVE,
    externalSlug: 'org-1/repo-1',
    integrationId: '1',
    externalId: 'ext-1',
    dateCreated: '2024-01-01T00:00:00Z',
  };

  const mockAllRepos = [
    RepositoryFixture({id: 'repo-1', name: 'org-1/repo-1'}),
    RepositoryFixture({id: 'repo-2', name: 'org-1/repo-2'}),
  ];

  const defaultProps: ManageReposPanelProps = {
    collapsed: false,
    onClose: jest.fn(),
    repo: mockRepo,
    org: mockOrg,
    allRepos: mockAllRepos,
    isEditingOrgDefaults: false,
  };

  const mockOrganization = OrganizationFixture({slug: 'test-org'});

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreventAIFeatureReturn = {
      enableFeature: jest.fn(),
      isLoading: false,
      error: undefined,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: PreventAIConfigFixture(),
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('calls onClose when the close button is clicked', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    await userEvent.click(await screen.findByLabelText(/Close Settings/i));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders the panel header and description with repo link when repo is selected', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(
      await screen.findByText('AI Code Review Repository Settings')
    ).toBeInTheDocument();
    expect(screen.getByText(/These settings apply to the selected/i)).toBeInTheDocument();
    const repoLink = await screen.findByRole('link', {name: /repo-1/i});
    expect(repoLink).toHaveAttribute('href', 'https://github.com/org-1/repo-1');
  });

  it('renders the panel header and description with org defaults when "All Repos" is selected', async () => {
    render(<ManageReposPanel {...defaultProps} repo={null} isEditingOrgDefaults />, {
      organization: mockOrganization,
    });
    expect(
      await screen.findByText('AI Code Review Default Settings')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/These settings apply to all repositories by default/i)
    ).toBeInTheDocument();
  });

  it('renders [none] when no repos have overrides when editing org defaults', async () => {
    render(<ManageReposPanel {...defaultProps} repo={null} isEditingOrgDefaults />, {
      organization: mockOrganization,
    });
    expect(await screen.findByText(/\[none\]/i)).toBeInTheDocument();
  });

  it('shows feature toggles with correct initial state when repo has overrides', async () => {
    const configWithOverride = PreventAIConfigFixture();
    configWithOverride.repo_overrides['ext-1'] = {
      vanilla: {
        enabled: true,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: true,
          on_new_commit: false,
        },
        sensitivity: 'low',
      },
      test_generation: {
        enabled: false,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
      },
      bug_prediction: {
        enabled: true,
        triggers: {
          on_command_phrase: true,
          on_ready_for_review: false,
          on_new_commit: false,
        },
        sensitivity: 'medium',
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: configWithOverride,
      },
    });

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeChecked();
    expect(
      await screen.findByLabelText(/Auto Run on Opened Pull Requests/i)
    ).not.toBeChecked();
    expect(await screen.findByLabelText(/Auto Run on New Commits/i)).not.toBeChecked();
    expect(await screen.findByLabelText(/Run when mentioned/i)).toBeChecked();
  });

  it('disables toggles when loading and repo has overrides', async () => {
    mockUpdatePreventAIFeatureReturn = {
      ...mockUpdatePreventAIFeatureReturn,
      isLoading: true,
    };

    const configWithOverride = PreventAIConfigFixture();
    configWithOverride.repo_overrides['ext-1'] = PreventAIConfigFixture().org_defaults;

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: configWithOverride,
      },
    });

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeDisabled();
  });

  it('hides all feature toggles when using org defaults', () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(screen.queryByLabelText(/Enable PR Review/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable Error Prediction/i)).not.toBeInTheDocument();
  });

  it('shows feature toggles when repo has overrides', async () => {
    const configWithOverride = PreventAIConfigFixture();
    configWithOverride.repo_overrides['ext-1'] = {
      bug_prediction: {
        enabled: true,
        triggers: {
          on_command_phrase: true,
          on_ready_for_review: false,
          on_new_commit: false,
        },
        sensitivity: 'high',
      },
      test_generation: {
        enabled: false,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
      },
      vanilla: {
        enabled: true,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
        sensitivity: 'medium',
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: configWithOverride,
      },
    });

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeEnabled();
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
    const configWithOverride = PreventAIConfigFixture();
    const repoOverride = {...PreventAIConfigFixture().org_defaults};
    // Enable the features
    repoOverride.vanilla.enabled = true;
    repoOverride.bug_prediction.enabled = true;
    repoOverride.bug_prediction.sensitivity = 'high';
    configWithOverride.repo_overrides['ext-1'] = repoOverride;

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: configWithOverride,
      },
    });

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByLabelText(/Enable PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeChecked();
    expect(
      await screen.findByTestId(/pr-review-sensitivity-dropdown/i)
    ).toBeInTheDocument();
    const predictionSens = await screen.findByTestId(
      /error-prediction-sensitivity-dropdown/i
    );
    expect(predictionSens).toBeInTheDocument();
    expect(predictionSens).toHaveTextContent(/High/i);
  });

  it('shows toggle for overriding organization defaults', async () => {
    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    expect(await screen.findByText('Override Organization Defaults')).toBeInTheDocument();
    expect(
      screen.getByText(/When enabled, you can customize settings for this repository/i)
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
      gitOrgName: 'org-1',
      originalConfig: PreventAIConfigFixture(),
      repoId: 'ext-1',
    });
  });

  it('does not show toggle when editing organization defaults', async () => {
    render(<ManageReposPanel {...defaultProps} repo={null} isEditingOrgDefaults />, {
      organization: mockOrganization,
    });
    expect(
      await screen.findByText(/These settings apply to all repositories by default/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /repo-1/i})).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Override Organization Defaults')
    ).not.toBeInTheDocument();
  });

  it('toggle is checked when repo has custom overrides', async () => {
    const configWithOverride = PreventAIConfigFixture();
    configWithOverride.repo_overrides['ext-1'] = {
      bug_prediction: {
        enabled: false,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
      },
      test_generation: {
        enabled: true,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
      },
      vanilla: {
        enabled: false,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: false,
          on_new_commit: false,
        },
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
      body: {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        default_org_config: PreventAIConfigFixture(),
        organization: configWithOverride,
      },
    });

    render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
    const toggle = await screen.findByLabelText('Override Organization Defaults');
    expect(toggle).toBeChecked();
  });

  describe('on_new_commit trigger', () => {
    it('shows on_new_commit toggle when error prediction is enabled', async () => {
      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      expect(await screen.findByLabelText(/Enable Error Prediction/i)).toBeChecked();
      expect(
        await screen.findByLabelText(/Auto Run on New Commits/i)
      ).toBeInTheDocument();
    });

    it('shows correct initial state for on_new_commit toggle', async () => {
      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: true,
            on_new_commit: true,
          },
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      expect(await screen.findByLabelText(/Auto Run on New Commits/i)).toBeChecked();
    });

    it('defaults to false when on_new_commit is undefined', async () => {
      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            // on_new_commit is undefined
          } as PreventAIFeatureTriggers,
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      expect(await screen.findByLabelText(/Auto Run on New Commits/i)).not.toBeChecked();
    });

    it('calls enableFeature with on_new_commit when toggle is clicked', async () => {
      const mockEnableFeature = jest.fn();
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: mockEnableFeature,
        isLoading: false,
      };

      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      const toggle = await screen.findByLabelText(/Auto Run on New Commits/i);
      await userEvent.click(toggle);

      expect(mockEnableFeature).toHaveBeenCalledWith({
        feature: 'bug_prediction',
        trigger: {on_new_commit: true},
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: configWithOverride,
        repoId: 'ext-1',
      });
    });

    it('disables on_new_commit toggle when loading', async () => {
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: jest.fn(),
        isLoading: true,
      };

      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      expect(await screen.findByLabelText(/Auto Run on New Commits/i)).toBeDisabled();
    });

    it('hides on_new_commit toggle when error prediction is disabled', async () => {
      const configWithOverride = PreventAIConfigFixture();
      configWithOverride.repo_overrides['ext-1'] = {
        ...PreventAIConfigFixture().org_defaults,
        bug_prediction: {
          enabled: false,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
          sensitivity: 'medium',
        },
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${mockOrganization.slug}/prevent/ai/github/config/org-1/`,
        body: {
          schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
          default_org_config: PreventAIConfigFixture(),
          organization: configWithOverride,
        },
      });

      render(<ManageReposPanel {...defaultProps} />, {organization: mockOrganization});
      expect(await screen.findByLabelText(/Enable Error Prediction/i)).not.toBeChecked();
      expect(screen.queryByLabelText(/Auto Run on New Commits/i)).not.toBeInTheDocument();
    });
  });

  describe('getRepoConfig', () => {
    it('returns org defaults when repoName is null', () => {
      const orgConfig: PreventAIConfig = {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          test_generation: {
            enabled: false,
            triggers: {
              on_command_phrase: false,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          vanilla: {
            enabled: true,
            triggers: {
              on_command_phrase: false,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
        },
        repo_overrides: {
          'ext-1': {
            bug_prediction: {
              enabled: false,
              triggers: {
                on_command_phrase: false,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
            test_generation: {
              enabled: true,
              triggers: {
                on_command_phrase: false,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
            vanilla: {
              enabled: false,
              triggers: {
                on_command_phrase: false,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
          },
        },
      };
      expect(getRepoConfig(orgConfig, '')).toEqual({
        doesUseOrgDefaults: true,
        repoConfig: orgConfig.org_defaults,
      });
    });

    it('returns repo override config when present', () => {
      const orgConfig: PreventAIConfig = {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: true,
              on_new_commit: false,
            },
          },
          test_generation: {
            enabled: false,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          vanilla: {
            enabled: true,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
        },
        repo_overrides: {
          'ext-1': {
            bug_prediction: {
              enabled: false,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
            test_generation: {
              enabled: true,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
            vanilla: {
              enabled: false,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
          },
        },
      };
      expect(getRepoConfig(orgConfig, 'ext-1')).toEqual({
        doesUseOrgDefaults: false,
        repoConfig: {
          bug_prediction: {
            enabled: false,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          test_generation: {
            enabled: true,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          vanilla: {
            enabled: false,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
        },
      });
    });

    it('returns org defaults when repo override is not present', () => {
      const orgConfig: PreventAIConfig = {
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
        org_defaults: {
          bug_prediction: {
            enabled: true,
            triggers: {
              on_command_phrase: true,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          test_generation: {
            enabled: false,
            triggers: {
              on_command_phrase: false,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
          vanilla: {
            enabled: true,
            triggers: {
              on_command_phrase: false,
              on_ready_for_review: false,
              on_new_commit: false,
            },
          },
        },
        repo_overrides: {},
      };
      expect(getRepoConfig(orgConfig, 'ext-2')).toEqual({
        doesUseOrgDefaults: true,
        repoConfig: orgConfig.org_defaults,
      });
    });
  });
});
