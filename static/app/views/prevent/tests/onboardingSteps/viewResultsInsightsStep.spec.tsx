import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ViewResultsInsightsStep} from 'sentry/views/prevent/tests/onboardingSteps/viewResultsInsightsStep';

describe('ViewResultsInsightsStep', () => {
  it('renders the step header with correct step number', () => {
    render(<ViewResultsInsightsStep step="3" />);

    expect(screen.getByText('Step 3: View results and insights')).toBeInTheDocument();
  });

  it('renders all expected content sections', () => {
    render(<ViewResultsInsightsStep step="1" />);

    // Check header
    expect(screen.getByText('Step 1: View results and insights')).toBeInTheDocument();

    // Check description
    expect(
      screen.getByText(
        "After the test run completion, you'll be able to see the failed tests result in the following areas:"
      )
    ).toBeInTheDocument();

    // Check list items
    expect(screen.getByText('GitHub pull request comment')).toBeInTheDocument();
    expect(screen.getByText('Tests Analytics dashboard here')).toBeInTheDocument();
  });
});
