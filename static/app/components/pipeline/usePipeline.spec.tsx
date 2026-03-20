import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PipelineDefinition, PipelineStepProps} from './types';
import {usePipeline} from './usePipeline';

function StepOne({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{greeting: string}>) {
  return (
    <div>
      <p>{stepData.greeting}</p>
      <button disabled={isAdvancing} onClick={() => advance({answer: 'yes'})}>
        Next
      </button>
    </div>
  );
}

function StepTwo({stepData, advance}: PipelineStepProps<{question: string}>) {
  return (
    <div>
      <p>{stepData.question}</p>
      <button onClick={() => advance()}>Finish</button>
    </div>
  );
}

const testPipeline = {
  type: 'integration',
  provider: 'github',
  actionTitle: 'Test Pipeline',
  onComplete: (data: Record<string, unknown>) => data as {result: string},
  steps: [
    {stepId: 'step_one', shortDescription: 'Step One', component: StepOne},
    {stepId: 'step_two', shortDescription: 'Step Two', component: StepTwo},
  ],
} as const satisfies PipelineDefinition;

jest.mock('./registry', () => ({
  ...jest.requireActual('./registry'),
  getPipelineDefinition: () => testPipeline,
}));

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;

function TestHarness() {
  const pipeline = usePipeline('integration', 'github');

  return (
    <div>
      <div data-test-id="step">{pipeline.stepDefinition?.stepId ?? 'none'}</div>
      <div data-test-id="step-index">{pipeline.stepIndex}</div>
      <div data-test-id="total-steps">{pipeline.totalSteps}</div>
      <div data-test-id="is-initializing">{String(pipeline.isInitializing)}</div>
      <div data-test-id="is-advancing">{String(pipeline.isAdvancing)}</div>
      <div data-test-id="is-complete">{String(pipeline.isComplete)}</div>
      <div data-test-id="error">{pipeline.error?.message ?? 'none'}</div>
      <div data-test-id="completion-data">
        {pipeline.completionData ? JSON.stringify(pipeline.completionData) : 'none'}
      </div>
      <div data-test-id="view">{pipeline.view}</div>
    </div>
  );
}

describe('usePipeline', () => {
  it('initializes the pipeline on mount and renders the first step', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {greeting: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'github'})],
    });

    render(<TestHarness />, {organization});

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('step_one');
    expect(screen.getByTestId('step-index')).toHaveTextContent('0');
    expect(screen.getByTestId('total-steps')).toHaveTextContent('2');
    expect(screen.getByTestId('is-complete')).toHaveTextContent('false');
  });

  it('advances through steps and completes the pipeline', async () => {
    const initializeRequest = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {greeting: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'github'})],
    });

    const advanceToStepTwo = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'advance',
        step: 'step_two',
        stepIndex: 1,
        totalSteps: 2,
        provider: 'github',
        data: {question: 'Are you sure?'},
      },
      match: [MockApiClient.matchData({answer: 'yes'})],
    });

    render(<TestHarness />, {organization});

    // Wait for initialization
    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(initializeRequest).toHaveBeenCalledTimes(1);

    // Advance to step two
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(await screen.findByText('Are you sure?')).toBeInTheDocument();
    expect(advanceToStepTwo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('step')).toHaveTextContent('step_two');
    expect(screen.getByTestId('step-index')).toHaveTextContent('1');

    // Set up complete mock now that we're past initialization to avoid matching the init POST
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'complete',
        data: {result: 'success'},
      },
    });

    // Complete the pipeline
    await userEvent.click(screen.getByRole('button', {name: 'Finish'}));

    await waitFor(() => {
      expect(screen.getByTestId('is-complete')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('completion-data')).toHaveTextContent(
      '{"result":"success"}'
    );
  });

  it('handles stay responses by merging data into step data', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {greeting: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'github'})],
    });

    render(<TestHarness />, {organization});
    expect(await screen.findByText('Hello!')).toBeInTheDocument();

    // Override mock for advance — return stay with redirect data
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'stay',
        data: {redirectUrl: 'https://example.com/auth'},
      },
      match: [MockApiClient.matchData({answer: 'yes'})],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    // Should stay on same step
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('step_one');
    });
    // Step component still rendered (step didn't change)
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('handles error responses from the API', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {greeting: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'github'})],
    });

    render(<TestHarness />, {organization});
    expect(await screen.findByText('Hello!')).toBeInTheDocument();

    // Override mock — return pipeline error
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'error',
        data: {detail: 'Something went wrong'},
      },
      match: [MockApiClient.matchData({answer: 'yes'})],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Something went wrong');
    });
  });

  it('does not initialize when enabled is false', async () => {
    const initRequest = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {greeting: 'Hello!'},
      },
    });

    function DisabledHarness() {
      const pipeline = usePipeline('integration', 'github', {enabled: false});
      return (
        <div>
          <div data-test-id="is-initializing">{String(pipeline.isInitializing)}</div>
          <div data-test-id="step">{pipeline.stepDefinition?.stepId ?? 'none'}</div>
        </div>
      );
    }

    render(<DisabledHarness />, {organization});

    // Give it a tick to potentially fire
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('none');
    });
    expect(initRequest).not.toHaveBeenCalled();
  });
});
