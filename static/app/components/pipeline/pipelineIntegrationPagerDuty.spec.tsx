import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {pagerDutyIntegrationPipeline} from './pipelineIntegrationPagerDuty';
import type {PipelineStepProps} from './types';

const PagerDutyInstallStep = pagerDutyIntegrationPipeline.steps[0].component;

function makeStepProps<D, A>(
  overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
): PipelineStepProps<D, A> {
  return {
    advance: jest.fn(),
    advanceError: null,
    isAdvancing: false,
    stepIndex: 0,
    totalSteps: 1,
    ...overrides,
  };
}

let mockPopup: Window;

function dispatchPipelineMessage({
  data,
  origin = document.location.origin,
  source = mockPopup,
}: {
  data: Record<string, string>;
  origin?: string;
  source?: Window | MessageEventSource | null;
}) {
  act(() => {
    const event = new MessageEvent('message', {data, origin});
    Object.defineProperty(event, 'source', {value: source});
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  mockPopup = {
    closed: false,
    close: jest.fn(),
    focus: jest.fn(),
  } as unknown as Window;
  jest.spyOn(window, 'open').mockReturnValue(mockPopup);
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
