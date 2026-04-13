import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {usePipeline} from './usePipeline';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;

function TestHarness({onComplete}: {onComplete?: (data: any) => void} = {}) {
  const pipeline = usePipeline('integration', 'dummy', {onComplete});

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
      <button data-test-id="restart" onClick={pipeline.restart}>
        Restart
      </button>
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
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
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
        provider: 'dummy',
        data: {message: 'Enter your name'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });

    const advanceToStepTwo = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'advance',
        step: 'step_two',
        stepIndex: 1,
        totalSteps: 2,
        provider: 'dummy',
        data: {greeting: 'Hello, Test User!'},
      },
      match: [MockApiClient.matchData({name: 'Test User'})],
    });

    render(<TestHarness />, {organization});

    // Wait for initialization
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(initializeRequest).toHaveBeenCalledTimes(1);

    // Fill in the input and advance
    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test User');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('Hello, Test User!')).toBeInTheDocument();
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

    expect(await screen.findByText('{"result":"success"}')).toBeInTheDocument();
    expect(screen.getByTestId('is-complete')).toHaveTextContent('true');
  });

  it('handles stay responses by merging data into step data', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
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
      match: [MockApiClient.matchData({name: 'Test'})],
    });

    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Should stay on same step — wait for the mutation to settle,
    // then verify step didn't change
    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('step_one');
  });

  it('handles error responses from the API', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
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
      match: [MockApiClient.matchData({name: 'Test'})],
    });

    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();

    // Restart should recover from the error and re-initialize
    await userEvent.click(screen.getByTestId('restart'));

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByTestId('step')).toHaveTextContent('step_one');
  });

  it('restarts the pipeline from the beginning', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });

    const advanceToStepTwo = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'advance',
        step: 'step_two',
        stepIndex: 1,
        totalSteps: 2,
        provider: 'dummy',
        data: {greeting: 'Are you sure?'},
      },
      match: [MockApiClient.matchData({name: 'Test'})],
    });

    render(<TestHarness />, {organization});

    expect(await screen.findByText('Hello!')).toBeInTheDocument();

    // Type a name and advance to step two
    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(await screen.findByText('Are you sure?')).toBeInTheDocument();
    expect(advanceToStepTwo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('step')).toHaveTextContent('step_two');

    // Restart — should re-initialize and go back to step one
    await userEvent.click(screen.getByTestId('restart'));

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('step_one');
    expect(screen.getByTestId('step-index')).toHaveTextContent('0');
  });

  it('renders the completion view and defers onComplete until finish is called', async () => {
    const onComplete = jest.fn();

    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'dummy',
        data: {message: 'Enter your name'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });

    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'advance',
        step: 'step_two',
        stepIndex: 1,
        totalSteps: 2,
        provider: 'dummy',
        data: {greeting: 'Hello, Test!'},
      },
      match: [MockApiClient.matchData({name: 'Test'})],
    });

    render(<TestHarness onComplete={onComplete} />, {organization});

    // Advance through step one
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Advance through step two
    expect(await screen.findByText('Hello, Test!')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        status: 'complete',
        data: {result: 'Pipeline finished successfully'},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Finish'}));

    // Completion view should render with the result text and a Done button
    expect(await screen.findByText('Pipeline finished successfully')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
    expect(screen.getByTestId('is-complete')).toHaveTextContent('true');

    // onComplete should NOT have been called yet — it's deferred
    expect(onComplete).not.toHaveBeenCalled();

    // Clicking Done calls finish(), which fires onComplete
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));

    expect(onComplete).toHaveBeenCalledWith({result: 'Pipeline finished successfully'});
  });

  it('does not initialize when enabled is false', async () => {
    const initRequest = MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
    });

    function DisabledHarness() {
      const pipeline = usePipeline('integration', 'dummy', {enabled: false});
      return (
        <div>
          <div data-test-id="is-initializing">{String(pipeline.isInitializing)}</div>
          <div data-test-id="step">{pipeline.stepDefinition?.stepId ?? 'none'}</div>
        </div>
      );
    }

    render(<DisabledHarness />, {organization});

    // Give it a tick to potentially fire
    expect(await screen.findByText('none')).toBeInTheDocument();
    expect(initRequest).not.toHaveBeenCalled();
  });
});
