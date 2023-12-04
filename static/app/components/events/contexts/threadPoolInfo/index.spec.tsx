import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ThreadPoolInfoEventContext} from 'sentry/components/events/contexts/threadPoolInfo';
import {ThreadPoolInfoContext} from 'sentry/types';

export const threadPoolInfoMockData: ThreadPoolInfoContext = {
  available_completion_port_threads: 1000,
  available_worker_threads: 32766,
  max_completion_port_threads: 1000,
  max_worker_threads: 32767,
  min_completion_port_threads: 1,
  min_worker_threads: 10,
  type: 'threadpool_info',
};

export const threadPoolInfoMetaMockData = {
  '': {
    rem: [['organization:0', 'x']],
  },
};

const event = EventFixture({
  _meta: {
    contexts: {
      threadpool_info: threadPoolInfoMetaMockData,
    },
  },
});

describe('thread pool info event context', function () {
  it('display redacted data', function () {
    render(<ThreadPoolInfoEventContext event={event} data={null} />);
    expect(screen.queryByText('Thread Pool Info')).not.toBeInTheDocument();
  });
});
