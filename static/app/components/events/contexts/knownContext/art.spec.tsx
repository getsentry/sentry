import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getARTContextData,
  type ARTContext,
} from 'sentry/components/events/contexts/knownContext/art';

const MOCK_ART_CONTEXT: ARTContext = {
  'gc.blocking_count': 5,
  'gc.pre_oome_count': 9,
  'gc.total_time': 600,
  'gc.waiting_time': 200,
  'memory.free': 2048,
  'memory.free_until_gc': 4096,
  'memory.max': 536870912,
  'memory.total': 268435456,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  'gc.total_time': {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('ARTContext', () => {
  it('returns formatted values', () => {
    expect(getARTContextData({data: MOCK_ART_CONTEXT})).toEqual([
      {key: 'gc.blocking_count', subject: 'GC Blocking Count', value: 5},
      {key: 'gc.pre_oome_count', subject: 'GC Pre-OOME Count', value: 9},
      {key: 'gc.total_time', subject: 'GC Total Time', value: '600.00ms'},
      {key: 'gc.waiting_time', subject: 'GC Waiting Time', value: '200.00ms'},
      {key: 'memory.free', subject: 'Memory Free', value: '2.0 KiB'},
      {key: 'memory.free_until_gc', subject: 'Memory Free Until GC', value: '4.0 KiB'},
      {key: 'memory.max', subject: 'Memory Max', value: '512.0 MiB'},
      {key: 'memory.total', subject: 'Memory Total', value: '256.0 MiB'},
      {key: 'extra_data', subject: 'extra_data', value: 'something'},
      {key: 'unknown_key', subject: 'unknown_key', value: 123},
    ]);
  });

  it('renders with meta annotations correctly', () => {
    const event = EventFixture({
      _meta: {contexts: {art: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="art"
        alias="art"
        value={{...MOCK_ART_CONTEXT, 'gc.total_time': ''}}
      />
    );

    expect(screen.getByText('Android Runtime')).toBeInTheDocument();
    expect(screen.getByText('GC Blocking Count')).toBeInTheDocument();
    expect(screen.getByText('Memory Free')).toBeInTheDocument();
    expect(screen.getByText('2.0 KiB')).toBeInTheDocument();
    expect(screen.getByText('GC Total Time')).toBeInTheDocument();
  });
});
