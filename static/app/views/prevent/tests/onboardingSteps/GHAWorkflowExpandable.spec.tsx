import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';

describe('GHAWorkflowExpandable', () => {
  it('renders the trigger content with pytest text', () => {
    render(<GHAWorkflowExpandable />);

    expect(
      screen.getByText(/A GitHub Actions workflow for a repository using/)
    ).toBeInTheDocument();
    expect(screen.getByText('pytest')).toBeInTheDocument();
  });

  it('shows the workflow snippet when expanded', async () => {
    render(<GHAWorkflowExpandable />);

    const trigger = screen.getByText(/A GitHub Actions workflow for a repository using/);
    await userEvent.click(trigger);

    expect(
      await screen.findByText(/name: Workflow for Sentry Prevent Action/)
    ).toBeInTheDocument();
    expect(screen.getByText(/on: [push, pull_request]/)).toBeInTheDocument();
  });
});
