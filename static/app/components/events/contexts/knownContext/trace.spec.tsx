import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getTraceContextData,
  type TraceContext,
} from 'sentry/components/events/contexts/knownContext/trace';

const TRACE_ID = '61d2d7c5acf448ffa8e2f8f973e2cd36';
const MOCK_TRACE_CONTEXT: TraceContext = {
  type: 'default',
  trace_id: TRACE_ID,
  span_id: '0415201309082013',
  parent_span_id: '123456',
  description: '<OrganizationContext>',
  op: 'http.server',
  status: 'not_found',
  exclusive_time: 1.035,
  client_sample_rate: 0.1,
  dynamic_sampling_context: {
    trace_id: TRACE_ID,
    sample_rate: '1.0',
    public_key: '93D0D1125146288EAEE2A9B3AF4F96CCBE3CB316',
  },
  origin: 'auto.http.http_client_5',
  data: {
    route: {
      name: 'HomeRoute',
    },
  },
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  origin: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('TraceContext', () => {
  const location = LocationFixture();
  const organization = OrganizationFixture({
    features: ['performance-view'],
    extraOptions: {
      traces: {
        checkSpanExtractionDate: false,
        spansExtractionDate: 1,
      },
    },
  });

  it('returns values and according to the parameters', () => {
    expect(
      getTraceContextData({
        data: MOCK_TRACE_CONTEXT,
        event: EventFixture({
          timestamp: 2,
          contexts: {
            trace: {
              trace_id: TRACE_ID,
            },
          },
        }),
        organization,
        location,
      })
    ).toEqual([
      {
        key: 'trace_id',
        subject: 'Trace ID',
        value: TRACE_ID,
        action: {
          link: expect.objectContaining({
            pathname: `/organizations/org-slug/explore/traces/trace/${TRACE_ID}/`,
          }),
        },
      },
      {key: 'span_id', subject: 'Span ID', value: '0415201309082013'},
      {key: 'parent_span_id', subject: 'Parent Span ID', value: '123456'},
      {
        key: 'description',
        subject: 'description',
        value: '<OrganizationContext>',
        meta: undefined,
      },
      {key: 'op', subject: 'Operation Name', value: 'http.server'},
      {key: 'status', subject: 'Status', value: 'not_found'},
      {
        key: 'exclusive_time',
        subject: 'Exclusive Time (ms)',
        value: 1.035,
      },
      {
        key: 'client_sample_rate',
        subject: 'Client Sample Rate',
        value: 0.1,
      },
      {
        key: 'dynamic_sampling_context',
        subject: 'Dynamic Sampling Context',
        value: {
          trace_id: TRACE_ID,
          sample_rate: '1.0',
          public_key: '93D0D1125146288EAEE2A9B3AF4F96CCBE3CB316',
        },
      },
      {
        key: 'origin',
        subject: 'Origin',
        value: 'auto.http.http_client_5',
      },
      {
        key: 'data',
        subject: 'Data',
        value: {
          route: {
            name: 'HomeRoute',
          },
        },
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

  it('renders with meta annotations correctly', () => {
    const event = EventFixture({
      _meta: {contexts: {trace: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="default"
        alias="trace"
        value={{...MOCK_TRACE_CONTEXT, origin: ''}}
      />,
      {organization}
    );

    expect(screen.getByText('Trace Details')).toBeInTheDocument();
    expect(screen.getByText('Trace ID')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: TRACE_ID})).toBeInTheDocument();
    expect(screen.getByText('Origin')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });

  it('returns trace_id with tooltip when trace is not sampled', () => {
    const result = getTraceContextData({
      data: {trace_id: TRACE_ID, sampled: false},
      event: EventFixture(),
      organization,
      location,
    });

    const traceItem = result.find(item => item.key === 'trace_id');
    expect(traceItem).toMatchObject({
      key: 'trace_id',
      subject: 'Trace ID',
    });
    // When not sampled, value is a React element (Tooltip) not a string
    expect(traceItem?.action).toBeUndefined();
  });
});
