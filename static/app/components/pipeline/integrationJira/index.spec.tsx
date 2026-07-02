import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {jiraIntegrationPipeline} from '.';

const JiraConfirmInstallStep = jiraIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('JiraConfirmInstallStep', () => {
  const stepData = {
    baseUrl: 'https://example.atlassian.net',
    organization: 'My Org',
    state: 'pipeline-sig',
  };

  it('renders the workspace, organization, and a warning without auto-advancing', () => {
    const advance = jest.fn();
    render(<JiraConfirmInstallStep {...makeStepProps({stepData, advance})} />);

    expect(
      screen.getByRole('heading', {name: 'Connect Jira to Sentry'})
    ).toBeInTheDocument();
    expect(screen.getByText('https://example.atlassian.net')).toBeInTheDocument();
    expect(screen.getByText(/My Org/)).toBeInTheDocument();
    expect(
      screen.getByText(/If you did not start this installation yourself/)
    ).toBeInTheDocument();

    // No auto-advance: the user must click to confirm.
    expect(advance).not.toHaveBeenCalled();
  });

  it('advances with the pipeline state when the install button is clicked', async () => {
    const advance = jest.fn();
    render(<JiraConfirmInstallStep {...makeStepProps({stepData, advance})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Install Jira integration'}));

    expect(advance).toHaveBeenCalledWith({state: 'pipeline-sig'});
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('disables the install button until step data is available', () => {
    const advance = jest.fn();
    render(<JiraConfirmInstallStep {...makeStepProps({stepData: null, advance})} />);

    expect(screen.getByRole('button', {name: 'Install Jira integration'})).toBeDisabled();
    expect(advance).not.toHaveBeenCalled();
  });
});
