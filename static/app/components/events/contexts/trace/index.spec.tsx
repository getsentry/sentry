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
  trace_id: '12312012123120121231201212312012',
  span_id: '0415201309082013',
  parent_span_id: '123',
  description: '<OrganizationContext>',
  op: 'http.server',
  status: 'not_found',
  exclusive_time: 1.035,
  client_sample_rate: 0.1,
  dynamic_sampling_context: {
    trace_id: '12312012123120121231201212312012',
    sample_rate: '1.0',
    public_key: '93D0D1125146288EAEE2A9B3AF4F96CCBE3CB316',
  },
  origin: 'auto.http.http_client_5',
  data: {
    route: {
      name: 'HomeRoute',
    },
  },
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
