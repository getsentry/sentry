import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {getMemoryInfoContext} from 'sentry/components/events/contexts/knownContext/memoryInfo';
import type {MemoryInfoContext} from 'sentry/types/event';

const MOCK_MEMORY_INFO_CONTEXT: MemoryInfoContext = {
  type: 'memory_info',
  allocated_bytes: 1048576 * 1,
  fragmented_bytes: 1048576 * 2,
  heap_size_bytes: 1048576 * 3,
  high_memory_load_threshold_bytes: 1048576 * 4,
  total_available_memory_bytes: 1048576 * 5,
  memory_load_bytes: 1048576 * 6,
  total_committed_bytes: 1048576 * 7,
  promoted_bytes: 1048576 * 8,
  pinned_objects_count: 150,
  pause_time_percentage: 25.5,
  index: 12,
  finalization_pending_count: 0,
  compacted: true,
  concurrent: true,
  pause_durations: [0, 0],
};

const MOCK_REDACTION = {
  pinned_objects_count: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('MemoryInfoContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getMemoryInfoContext({data: MOCK_MEMORY_INFO_CONTEXT})).toEqual([
      {key: 'allocated_bytes', subject: 'Allocated Bytes', value: '1.0 MiB'},
      {key: 'fragmented_bytes', subject: 'Fragmented Bytes', value: '2.0 MiB'},
      {key: 'heap_size_bytes', subject: 'Heap Size Bytes', value: '3.0 MiB'},
      {
        key: 'high_memory_load_threshold_bytes',
        subject: 'High Memory Load Threshold Bytes',
        value: '4.0 MiB',
      },
      {
        key: 'total_available_memory_bytes',
        subject: 'Total Available Memory Bytes',
        value: '5.0 MiB',
      },
      {key: 'memory_load_bytes', subject: 'Memory Load Bytes', value: '6.0 MiB'},
      {key: 'total_committed_bytes', subject: 'Total Committed Bytes', value: '7.0 MiB'},
      {key: 'promoted_bytes', subject: 'Promoted Bytes', value: '8.0 MiB'},
      {key: 'pinned_objects_count', subject: 'Pinned Objects Count', value: 150},
      {key: 'pause_time_percentage', subject: 'Pause Time Percentage', value: 25.5},
      {key: 'index', subject: 'Index', value: 12},
      {
        key: 'finalization_pending_count',
        subject: 'Finalization Pending Count',
        value: 0,
      },
      {key: 'compacted', subject: 'Compacted', value: true},
      {key: 'concurrent', subject: 'Concurrent', value: true},
      {key: 'pause_durations', subject: 'Pause Durations', value: [0, 0]},
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {memory_info: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'memory_info'}
        alias={'memory_info'}
        value={{...MOCK_MEMORY_INFO_CONTEXT, pinned_objects_count: ''}}
      />
    );

    expect(screen.getByText('Memory Info')).toBeInTheDocument();
    expect(screen.getByText('Allocated Bytes')).toBeInTheDocument();
    expect(screen.getByText('1.0 MiB')).toBeInTheDocument();
    expect(screen.getByText('Pinned Objects Count')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
