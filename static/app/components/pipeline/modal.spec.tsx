import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';

import {openPipelineModal, PipelineModal} from './modal';

const organization = OrganizationFixture();
const API_URL = `/organizations/${organization.slug}/pipeline/integration_pipeline/`;

describe('PipelineModal', () => {
  it('hides the step counter row when the pipeline has only one step', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 1,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });

    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'dummy'}));

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of 1/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Back'})).not.toBeInTheDocument();
  });

  it('shows a back button when a host modal shows the flow in place', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 1,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });
    const onBack = jest.fn();

    renderGlobalModal({organization});

    act(() =>
      openModal(deps => (
        <PipelineModal {...deps} type="integration" provider="dummy" onBack={onBack} />
      ))
    );

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the step counter row when the pipeline has more than one step', async () => {
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

    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'dummy'}));

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getAllByText(/Step 1 of 2/).length).toBeGreaterThan(0);
  });

  it('reports a pipeline error to the caller', async () => {
    const onError = jest.fn();
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Installation failed'},
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });

    renderGlobalModal({organization});

    act(() => openPipelineModal({type: 'integration', provider: 'dummy', onError}));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Installation failed'));
  });

  it('runs in place inside a host modal and hands control back when it finishes', async () => {
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {
        step: 'step_one',
        stepIndex: 0,
        totalSteps: 1,
        provider: 'dummy',
        data: {message: 'Hello!'},
      },
      match: [MockApiClient.matchData({action: 'initialize', provider: 'dummy'})],
    });
    MockApiClient.addMockResponse({
      url: API_URL,
      method: 'POST',
      body: {status: 'complete', data: {result: 'Installed'}},
      match: [MockApiClient.matchData({name: 'Test'})],
    });
    const onComplete = jest.fn();

    function HostModal(deps: ModalRenderProps) {
      const [installing, setInstalling] = useState(false);

      if (installing) {
        return (
          <PipelineModal
            {...deps}
            closeModal={() => setInstalling(false)}
            type="integration"
            provider="dummy"
            onComplete={onComplete}
          />
        );
      }

      return (
        <deps.Body>
          Host content
          <Button onClick={() => setInstalling(true)}>Connect</Button>
        </deps.Body>
      );
    }

    renderGlobalModal({organization});

    act(() => openModal(deps => <HostModal {...deps} />));

    await userEvent.click(await screen.findByRole('button', {name: 'Connect'}));
    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.queryByText('Host content')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', {name: 'Your name'}), 'Test');
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Done'}));

    expect(onComplete).toHaveBeenCalledWith({result: 'Installed'});
    expect(await screen.findByText('Host content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
