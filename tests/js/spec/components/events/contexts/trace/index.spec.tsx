import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceEventContext} from 'sentry/components/events/contexts/trace';
import {OrganizationContext} from 'sentry/views/organizationContext';

export const traceMockData = {
  trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
  span_id: 'a5702f287954a9ef',
  parent_span_id: 'b23703998ae619e7',
  op: 'something',
  status: 'unknown',
  type: 'trace',
};

export const traceContextMetaMockData = {
  op: {
    '': {
      rem: [['project:1', 's', 0, 0]],
      len: 9,
    },
  },
};

describe('trace event context', function () {
  const {organization} = initializeOrg();
  const event = TestStubs.Event();
  const data = {
    tags: {
      url: 'https://github.com/getsentry/sentry/',
    },
  };

  it('renders text url as a link', function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <TraceEventContext organization={organization} data={data} event={event} />
      </OrganizationContext.Provider>
    );

    expect(screen.getByRole('link', {name: 'Open link'})).toHaveAttribute(
      'href',
      data.tags.url
    );
  });

  it.todo('display redacted data'); // Data Scrubbing has a couple of bugs that we need to address before creating a test for this
});
