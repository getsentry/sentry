import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
});
