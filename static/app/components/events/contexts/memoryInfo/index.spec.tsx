import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MemoryInfoEventContext} from 'sentry/components/events/contexts/memoryInfo';
import {MemoryInfoContext} from 'sentry/types';

export const memoryInfoMockData: MemoryInfoContext = {
  allocated_bytes: 9614872,
  compacted: false,
  concurrent: false,
  finalization_pending_count: 0,
  high_memory_load_threshold_bytes: 30923764531,
  pause_durations: [0, 0],
  total_available_memory_bytes: 34359738368,
  type: 'memory_info',
};

export const memoryInfoMetaMockData = {
  '': {
    rem: [['organization:0', 'x']],
  },
};

const event = EventFixture({
  _meta: {
    contexts: {
      memory_info: memoryInfoMetaMockData,
    },
  },
});

describe('memory info event context', function () {
  it('display redacted data', function () {
    render(<MemoryInfoEventContext event={event} data={null} />);
    expect(screen.queryByText('Memory Info')).not.toBeInTheDocument();
  });
});
