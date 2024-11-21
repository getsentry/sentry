import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {getThreadPoolInfoContext} from 'sentry/components/events/contexts/knownContext/threadPoolInfo';

const MOCK_THREAD_POOL_INFO_CONTEXT = {
  type: 'threadpool_info' as const,
  available_completion_port_threads: 1000,
  available_worker_threads: 32766,
  max_completion_port_threads: 3000,
  max_worker_threads: 32767,
  min_completion_port_threads: 1,
  min_worker_threads: 10,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  max_worker_threads: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('ThreadPoolInfoContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getThreadPoolInfoContext({data: MOCK_THREAD_POOL_INFO_CONTEXT})).toEqual([
      {
        key: 'available_completion_port_threads',
        subject: 'Available Completion Port Threads',
        value: 1000,
      },
      {
        key: 'available_worker_threads',
        subject: 'Available Worker Threads',
        value: 32766,
      },
      {
        key: 'max_completion_port_threads',
        subject: 'Max Completion Port Threads',
        value: 3000,
      },
      {
        key: 'max_worker_threads',
        subject: 'Max Worker Threads',
        value: 32767,
      },
      {
        key: 'min_completion_port_threads',
        subject: 'Min Completion Port Threads',
        value: 1,
      },
      {
        key: 'min_worker_threads',
        subject: 'Min Worker Threads',
        value: 10,
      },
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
        meta: undefined,
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
        meta: undefined,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {threadpool_info: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'threadpool_info'}
        alias={'threadpool_info'}
        value={{...MOCK_THREAD_POOL_INFO_CONTEXT, max_worker_threads: ''}}
      />
    );

    expect(screen.getByText('Thread Pool Info')).toBeInTheDocument();
    expect(screen.getByText('Available Completion Port Threads')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Max Worker Threads')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
