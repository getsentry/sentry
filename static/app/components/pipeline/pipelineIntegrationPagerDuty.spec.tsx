import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {pagerDutyIntegrationPipeline} from './pipelineIntegrationPagerDuty';
import {createMakeStepProps, dispatchPipelineMessage, setupMockPopup} from './testUtils';

const PagerDutyInstallStep = pagerDutyIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PagerDutyInstallStep', () => {
  it('renders the install step for PagerDuty', () => {
    render(
      <PagerDutyInstallStep
        {...makeStepProps({
          stepData: {installUrl: 'https://app.pagerduty.com/install/integration'},
        })}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Install PagerDuty App'})
    ).toBeInTheDocument();
  });

  it('calls advance with config on callback', async () => {
    const advance = jest.fn();
    render(
      <PagerDutyInstallStep
        {...makeStepProps({
          stepData: {installUrl: 'https://app.pagerduty.com/install/integration'},
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Install PagerDuty App'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        config: '{"account":{"name":"Test","subdomain":"test"}}',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      config: '{"account":{"name":"Test","subdomain":"test"}}',
    });
  });

  it('shows loading state when isAdvancing is true', () => {
    render(
      <PagerDutyInstallStep
        {...makeStepProps({
          stepData: {installUrl: 'https://app.pagerduty.com/install/integration'},
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Installing...'})).toBeDisabled();
  });

  it('disables install button when installUrl is not provided', () => {
    render(<PagerDutyInstallStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Install PagerDuty App'})).toBeDisabled();
  });
});
