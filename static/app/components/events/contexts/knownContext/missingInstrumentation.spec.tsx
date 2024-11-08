import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getMissingInstrumentationContextData,
  type MissingInstrumentationContext,
} from 'sentry/components/events/contexts/knownContext/missingInstrumentation';

const MOCK_MISSING_INSTRUMENTATION_CONTEXT: MissingInstrumentationContext = {
  package: 'express',
  'javascript.is_cjs': true,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  ['package']: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 7,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

describe('MissingInstrumentationContext', function () {
  it('returns formatted data correctly', function () {
    expect(
      getMissingInstrumentationContextData({data: MOCK_MISSING_INSTRUMENTATION_CONTEXT})
    ).toEqual([
      {
        key: 'package',
        subject: 'Package w/o Instrumentation',
        value: 'express',
      },
      {
        key: 'javascript.is_cjs',
        subject: 'From CommonJS Module?',
        value: true,
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
      _meta: {contexts: {missing_instrumentation: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'missing_instrumentation'}
        alias={'missing_instrumentation'}
        value={{...MOCK_MISSING_INSTRUMENTATION_CONTEXT, package: ''}}
      />
    );

    expect(screen.getByText('Missing OTEL Instrumentation')).toBeInTheDocument();
    expect(screen.getByText('From CommonJS Module?')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Package w/o Instrumentation')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
