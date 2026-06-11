import {render, screen} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {vercelIntegrationPipeline} from '.';

const VercelInstallStep = vercelIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('VercelInstallStep', () => {
  it('auto-advances with the pipeline state and shows a finishing message', () => {
    const advance = jest.fn();
    render(
      <VercelInstallStep
        {...makeStepProps({
          stepData: {state: 'pipeline-sig'},
          advance,
        })}
      />
    );

    expect(advance).toHaveBeenCalledWith({state: 'pipeline-sig'});
    expect(advance).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Finishing up Vercel integration installation...')
    ).toBeInTheDocument();
  });

  it('does not advance until stepData is available', () => {
    const advance = jest.fn();
    render(<VercelInstallStep {...makeStepProps({stepData: null, advance})} />);

    expect(advance).not.toHaveBeenCalled();
  });
});
