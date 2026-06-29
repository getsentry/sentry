import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openPipelineModal} from './modal';

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
});
