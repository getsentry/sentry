import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';

let mockUpdatePreventAIFeatureReturn: any = {};
jest.mock('sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature', () => ({
  useUpdatePreventAIFeature: () => mockUpdatePreventAIFeatureReturn,
}));

let mockPreventAIConfigReturn: any = {};
jest.mock('sentry/views/prevent/preventAI/hooks/usePreventAIConfig', () => ({
  usePreventAIConfig: () => mockPreventAIConfigReturn,
}));

const getMockConfig = (overrides = {}) => ({
  data: {
    features: {
      vanilla: {enabled: true},
      test_generation: {enabled: false},
      bug_prediction: {
        enabled: true,
        sensitivity: 'medium',
        triggers: {on_ready_for_review: false, on_command_phrase: true},
      },
      ...(overrides as any).features,
    },
  },
  isLoading: false,
  refetch: jest.fn(),
  isError: false,
  ...overrides,
});

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
    localStorage.clear();
    mockUpdatePreventAIFeatureReturn = {};
  });

  it('renders the panel header and description with repo link', async () => {
    mockPreventAIConfigReturn = getMockConfig();
    render(<ManageReposPanel {...defaultProps} />);
    expect(await screen.findByText('AI Code Review Settings')).toBeInTheDocument();
    expect(
      await screen.findByText(/These settings apply to the selected/i)
    ).toBeInTheDocument();
    const repoLink = await screen.findByRole('link', {name: /repo-1/i});
    expect(repoLink).toHaveAttribute('href', 'https://github.com/org-1/repo-1');
  });

  it('calls onClose when the close button is clicked', async () => {
    mockPreventAIConfigReturn = getMockConfig();
    render(<ManageReposPanel {...defaultProps} />);
    const closeButton = await screen.findByLabelText(/Close Settings/i);
    await userEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows feature toggles with correct initial state', async () => {
    mockPreventAIConfigReturn = getMockConfig();
    render(<ManageReposPanel {...defaultProps} />);
    expect(await screen.findByLabelText(/PR Review/i)).toBeChecked();
    expect(await screen.findByLabelText(/Test Generation/i)).not.toBeChecked();
    expect(await screen.findByLabelText(/Error Prediction/i)).toBeChecked();
    expect(
      await screen.findByLabelText(/Auto Run on Opened Pull Requests/i)
    ).not.toBeChecked();
    expect(await screen.findByLabelText(/Run when mentioned/i)).toBeChecked();
  });

  it('disables toggles when loading', async () => {
    mockPreventAIConfigReturn = getMockConfig({isLoading: true});
    render(<ManageReposPanel {...defaultProps} />);
    expect(await screen.findByLabelText(/PR Review/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Test Generation/i)).toBeDisabled();
    expect(await screen.findByLabelText(/Error Prediction/i)).toBeDisabled();
  });

  it('shows error message if updateError is present', async () => {
    mockPreventAIConfigReturn = getMockConfig();
    mockUpdatePreventAIFeatureReturn = {
      enableFeature: jest.fn(),
      isLoading: false,
      error: 'Something went wrong',
    };
    render(<ManageReposPanel {...defaultProps} />);
    expect(await screen.findByText(/Could not update settings/i)).toBeInTheDocument();
  });

  it('calls refetch after enableFeature is called', async () => {
    const mockRefetch = jest.fn();
    mockPreventAIConfigReturn = getMockConfig({refetch: mockRefetch});
    mockUpdatePreventAIFeatureReturn = {
      enableFeature: jest.fn().mockResolvedValue({success: true}),
      isLoading: false,
      error: null,
    };

    render(<ManageReposPanel {...defaultProps} />);

    const prReviewToggle = await screen.findByLabelText(/PR Review/i);
    await userEvent.click(prReviewToggle);

    expect(mockUpdatePreventAIFeatureReturn.enableFeature).toHaveBeenCalledWith({
      feature: 'vanilla',
      enabled: false, // Toggle from true to false
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  describe('Sensitivity Controls', () => {
    beforeEach(() => {
      mockUpdatePreventAIFeatureReturn = {
        enableFeature: jest.fn().mockResolvedValue({success: true}),
        isLoading: false,
        error: null,
      };
    });

    it('shows sensitivity dropdown for vanilla PR review when enabled', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'medium'},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      expect(await screen.findByText('Sensitivity')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Medium/})).toBeInTheDocument();
    });

    it('hides sensitivity dropdown for vanilla PR review when disabled', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: false},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      expect(screen.queryByText('Sensitivity')).not.toBeInTheDocument();
    });

    it('shows sensitivity dropdown for bug prediction when enabled', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            bug_prediction: {
              enabled: true,
              sensitivity: 'high',
              triggers: {on_ready_for_review: false, on_command_phrase: true},
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      const sensitivityLabels = await screen.findAllByText('Sensitivity');
      expect(sensitivityLabels).toHaveLength(1);
      expect(screen.getByRole('button', {name: /High/})).toBeInTheDocument();
    });

    it('uses default sensitivity when config sensitivity is invalid', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'invalid_value'},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      expect(await screen.findByRole('button', {name: /Medium/})).toBeInTheDocument();
    });

    it('calls enableFeature with sensitivity when vanilla sensitivity changes', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'medium'},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Click the sensitivity dropdown
      const sensitivityButton = await screen.findByRole('button', {name: /Medium/});
      await userEvent.click(sensitivityButton);

      // Select "High" option
      const highOption = await screen.findByText('High');
      await userEvent.click(highOption);

      await waitFor(() => {
        expect(mockUpdatePreventAIFeatureReturn.enableFeature).toHaveBeenCalledWith({
          feature: 'vanilla',
          enabled: true,
          sensitivity: 'high',
        });
      });
    });

    it('calls enableFeature with sensitivity when bug prediction sensitivity changes', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            bug_prediction: {
              enabled: true,
              sensitivity: 'low',
              triggers: {on_ready_for_review: true, on_command_phrase: false},
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Click the sensitivity dropdown
      const sensitivityButton = await screen.findByRole('button', {name: /Low/});
      await userEvent.click(sensitivityButton);

      // Select "Critical" option
      const criticalOption = await screen.findByText('Critical');
      await userEvent.click(criticalOption);

      await waitFor(() => {
        expect(mockUpdatePreventAIFeatureReturn.enableFeature).toHaveBeenCalledWith({
          feature: 'bug_prediction',
          enabled: true,
          sensitivity: 'critical',
          triggers: {
            on_ready_for_review: true,
            on_command_phrase: false,
          },
        });
      });
    });

    it('includes sensitivity when updating bug prediction triggers', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            bug_prediction: {
              enabled: true,
              sensitivity: 'high',
              triggers: {on_ready_for_review: false, on_command_phrase: true},
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Toggle the "Auto Run on Opened Pull Requests" switch
      const autoRunToggle = await screen.findByLabelText(
        /Auto Run on Opened Pull Requests/i
      );
      await userEvent.click(autoRunToggle);

      await waitFor(() => {
        expect(mockUpdatePreventAIFeatureReturn.enableFeature).toHaveBeenCalledWith({
          feature: 'bug_prediction',
          enabled: true,
          triggers: {
            on_ready_for_review: true,
            on_command_phrase: true,
          },
          sensitivity: 'high',
        });
      });
    });

    it('displays all sensitivity options with correct labels and details', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'medium'},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Click the sensitivity dropdown
      const sensitivityButton = await screen.findByRole('button', {name: /Medium/});
      await userEvent.click(sensitivityButton);

      // Check all options are present with correct details
      expect(await screen.findByText('Low')).toBeInTheDocument();
      expect(
        screen.getByText('Post all potential issues for maximum breadth.')
      ).toBeInTheDocument();

      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(
        screen.getByText('Post likely issues for a balance of thoroughness and noise')
      ).toBeInTheDocument();

      expect(screen.getByText('High')).toBeInTheDocument();
      expect(
        screen.getByText('Post only major issues to highlight most impactful findings.')
      ).toBeInTheDocument();

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Post only high-impact, high-sensitivity issues for maximum focus.'
        )
      ).toBeInTheDocument();
    });

    it('synchronizes state when config changes externally', async () => {
      const initialConfig = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'low'},
          },
        },
      });
      mockPreventAIConfigReturn = initialConfig;

      const {rerender} = render(<ManageReposPanel {...defaultProps} />);

      expect(await screen.findByRole('button', {name: /Low/})).toBeInTheDocument();

      // Update the config externally
      const updatedConfig = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'critical'},
          },
        },
      });
      mockPreventAIConfigReturn = updatedConfig;

      rerender(<ManageReposPanel {...defaultProps} />);

      expect(await screen.findByRole('button', {name: /Critical/})).toBeInTheDocument();
    });

    it('calls refetch after sensitivity change', async () => {
      const mockRefetch = jest.fn();
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'medium'},
          },
        },
        refetch: mockRefetch,
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Click the sensitivity dropdown and change value
      const sensitivityButton = await screen.findByRole('button', {name: /Medium/});
      await userEvent.click(sensitivityButton);

      const highOption = await screen.findByText('High');
      await userEvent.click(highOption);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('shows sensitivity help text', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'medium'},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      expect(
        await screen.findByText('Set the sensitivity level for PR review analysis.')
      ).toBeInTheDocument();
    });

    it('handles both features with sensitivity independently', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true, sensitivity: 'low'},
            bug_prediction: {
              enabled: true,
              sensitivity: 'high',
              triggers: {on_ready_for_review: false, on_command_phrase: true},
            },
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Both sensitivity controls should be present but show different values
      expect(await screen.findByRole('button', {name: /Low/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /High/})).toBeInTheDocument();
    });

    it('handles missing sensitivity gracefully with default', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: true}, // No sensitivity field
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Should default to medium
      expect(await screen.findByRole('button', {name: /Medium/})).toBeInTheDocument();
    });

    it('handles undefined config gracefully', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: undefined,
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Should not crash and not show sensitivity controls
      expect(screen.queryByText('Sensitivity')).not.toBeInTheDocument();
    });

    it('uses medium as default sensitivity for new features', async () => {
      mockPreventAIConfigReturn = getMockConfig({
        data: {
          features: {
            vanilla: {enabled: false},
          },
        },
      });

      render(<ManageReposPanel {...defaultProps} />);

      // Enable vanilla PR review
      const prReviewToggle = await screen.findByLabelText(/PR Review/i);
      await userEvent.click(prReviewToggle);

      // Should use default sensitivity when enabling
      await waitFor(() => {
        expect(mockUpdatePreventAIFeatureReturn.enableFeature).toHaveBeenCalledWith({
          feature: 'vanilla',
          enabled: true,
          sensitivity: 'medium',
        });
      });
    });
  });
});
