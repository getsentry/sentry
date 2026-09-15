import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  createMakeStepProps,
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {cursorOriginIntegrationPipeline} from '.';

const CursorOriginInstallStep = cursorOriginIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

const installUrl = 'https://cursor.com/codebase/apps/install?client_id=app_01example';

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Cursor Origin InstallStep', () => {
  it('opens the install url the backend built', async () => {
    render(<CursorOriginInstallStep {...makeStepProps({stepData: {installUrl}})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Install on Origin'}));

    expect(window.open).toHaveBeenCalledWith(
      installUrl,
      'pipeline_popup',
      expect.any(String)
    );
  });

  it('advances with the receipt the callback carries', async () => {
    const advance = jest.fn();
    render(
      <CursorOriginInstallStep {...makeStepProps({stepData: {installUrl}, advance})} />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Install on Origin'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        installation_receipt: 'receipt-jwt',
        state: 'signature',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      installationReceipt: 'receipt-jwt',
      state: 'signature',
    });
  });

  it('does not advance without a receipt', async () => {
    const advance = jest.fn();
    render(
      <CursorOriginInstallStep {...makeStepProps({stepData: {installUrl}, advance})} />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Install on Origin'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {_pipeline_source: 'sentry-pipeline', state: 'signature'},
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('disables the button until the install url arrives', () => {
    render(<CursorOriginInstallStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Install on Origin'})).toBeDisabled();
  });
});
