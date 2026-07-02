import {render, screen} from 'sentry-test/reactTestingLibrary';

import {createMakeStepProps} from 'sentry/components/pipeline/testUtils';

import {msTeamsIntegrationPipeline} from '.';

const MsTeamsInstallStep = msTeamsIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

describe('MsTeamsInstallStep', () => {
  it('auto-advances with the pipeline state and shows a finishing message', () => {
    const advance = jest.fn();
    render(
      <MsTeamsInstallStep
        {...makeStepProps({
          stepData: {appDirectoryInstall: true, state: 'pipeline-sig'},
          advance,
        })}
      />
    );

    expect(advance).toHaveBeenCalledWith({state: 'pipeline-sig'});
    expect(advance).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Finishing up Microsoft Teams integration installation...')
    ).toBeInTheDocument();
  });

  it('does not advance until stepData is available', () => {
    const advance = jest.fn();
    render(<MsTeamsInstallStep {...makeStepProps({stepData: null, advance})} />);

    expect(advance).not.toHaveBeenCalled();
  });
});
