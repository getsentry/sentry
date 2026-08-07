import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {vercelIntegrationPipeline} from '.';

const VercelOAuthStep = vercelIntegrationPipeline.steps[0].component;
const VercelConfirmInstallStep = vercelIntegrationPipeline.steps[1].component;

const makeStepProps = createMakeStepProps({totalSteps: 2});

describe('VercelOAuthStep', () => {
  it('auto-advances with the pipeline state and shows a connecting message', () => {
    const advance = jest.fn();
    render(
      <VercelOAuthStep
        {...makeStepProps({
          stepData: {state: 'pipeline-sig'},
          advance,
        })}
      />
    );

    expect(advance).toHaveBeenCalledWith({state: 'pipeline-sig'});
    expect(advance).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Connecting to Vercel...')).toBeInTheDocument();
  });

  it('does not advance until stepData is available', () => {
    const advance = jest.fn();
    render(<VercelOAuthStep {...makeStepProps({stepData: null, advance})} />);

    expect(advance).not.toHaveBeenCalled();
  });
});

describe('VercelConfirmInstallStep', () => {
  const stepData = {
    account: 'My Team Name',
    accountType: 'team',
    organization: 'My Org',
    state: 'pipeline-sig',
  };

  it('renders the account, organization, and a warning without auto-advancing', () => {
    const advance = jest.fn();
    render(
      <VercelConfirmInstallStep {...makeStepProps({stepData, advance, stepIndex: 1})} />
    );

    expect(
      screen.getByRole('heading', {name: 'Connect Vercel to Sentry'})
    ).toBeInTheDocument();
    expect(screen.getByText('Vercel team:')).toBeInTheDocument();
    expect(screen.getByText('My Team Name')).toBeInTheDocument();
    expect(screen.getByText(/My Org/)).toBeInTheDocument();
    expect(
      screen.getByText(/If you did not start this installation yourself/)
    ).toBeInTheDocument();

    // No auto-advance: the user must click to confirm.
    expect(advance).not.toHaveBeenCalled();
  });

  it('labels a personal account differently from a team', () => {
    render(
      <VercelConfirmInstallStep
        {...makeStepProps({
          stepData: {...stepData, accountType: 'user', account: 'my_user_name'},
          stepIndex: 1,
        })}
      />
    );

    expect(screen.getByText('Vercel account:')).toBeInTheDocument();
    expect(screen.getByText('my_user_name')).toBeInTheDocument();
  });

  it('advances with the pipeline state when the install button is clicked', async () => {
    const advance = jest.fn();
    render(
      <VercelConfirmInstallStep {...makeStepProps({stepData, advance, stepIndex: 1})} />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Install Vercel integration'})
    );

    expect(advance).toHaveBeenCalledWith({state: 'pipeline-sig'});
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('disables the install button until step data is available', () => {
    const advance = jest.fn();
    render(
      <VercelConfirmInstallStep
        {...makeStepProps({stepData: null, advance, stepIndex: 1})}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Install Vercel integration'})
    ).toBeDisabled();
    expect(advance).not.toHaveBeenCalled();
  });
});
