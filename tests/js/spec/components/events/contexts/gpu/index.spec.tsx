import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GPUEventContext} from 'sentry/components/events/contexts/gpu';
import {GPUData} from 'sentry/components/events/contexts/gpu/types';

export const gpuMockData: GPUData = {
  name: '',
  id: 0,
  vendor_id: 0,
  vendor_name: 'Apple',
  memory_size: 4096,
  api_type: '',
  multi_threaded_rendering: true,
  version: 'Metal',
  npot_support: 'Full',
};

export const gpuMetaMockData = {
  api_type: {
    '': {
      rem: [['project:7', 's', 0, 0]],
      len: 5,
    },
  },
  name: {
    '': {
      rem: [['project:6', 's', 0, 0]],
      len: 18,
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      gpu: gpuMetaMockData,
    },
  },
};

describe('gpu event context', function () {
  it('display redacted data', async function () {
    render(<GPUEventContext event={event} data={gpuMockData} />);

    expect(screen.getByText('API Type')).toBeInTheDocument(); // subject
    userEvent.hover(screen.getAllByText(/redacted/)[0]);
    expect(
      await screen.findByText('Replaced because of PII rule "project:7"')
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    userEvent.hover(screen.getAllByText(/redacted/)[1]);
    expect(
      await screen.findByText('Replaced because of PII rule "project:6"')
    ).toBeInTheDocument(); // tooltip description
  });
});
