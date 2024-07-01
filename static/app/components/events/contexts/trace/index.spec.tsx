import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {TraceEventContext} from 'sentry/components/events/contexts/trace';

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

const event = EventFixture({
  _meta: {
    contexts: {
      trace: traceContextMetaMockData,
    },
  },
});

describe('trace event context', function () {
  const data = {
    tags: {
      url: 'https://github.com/getsentry/sentry/',
    },
  };

  it('renders text url as a link', async function () {
    renderGlobalModal();
    render(
      <TraceEventContext
        data={data}
        event={EventFixture()}
        location={{query: {}} as Location}
      />
    );

    const linkHint = screen.getByRole('link', {name: 'Open link'});
    await userEvent.click(linkHint);
    expect(screen.getByTestId('external-link-warning')).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    render(
      <TraceEventContext data={data} event={event} location={{query: {}} as Location} />
    );

    expect(screen.getByText('Operation Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    await userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
