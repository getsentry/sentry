import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import GenerateSpikeProjectionsForBatch from 'admin/views/generateSpikeProjectionsForBatch';

describe('GenerateSpikeProjectionsForBatch', () => {
  beforeEach(() => {
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.test/api/0/'},
      {name: 'eu', url: 'https://eu.test/api/0/'},
    ]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('submits batch id to selected region', async () => {
    const requestMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/queue-spike-projection-batch/',
      method: 'POST',
      body: {},
    });

    render(<GenerateSpikeProjectionsForBatch />);

    const batchInput = await screen.findByLabelText('Batch ID:');
    await userEvent.clear(batchInput);
    await userEvent.type(batchInput, '13');
    expect(await screen.findByText('(Batch Run Time: 2:10 AM UTC)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(requestMock).toHaveBeenCalledWith(
      '/_admin/cells/us/queue-spike-projection-batch/',
      expect.objectContaining({
        method: 'POST',
        data: {batch_id: 13},
        host: 'https://us.test/api/0/',
      })
    );
  });
});
