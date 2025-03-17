import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  type CultureContext,
  getCultureContextData,
} from 'sentry/components/events/contexts/knownContext/culture';

const MOCK_CULTURE_CONTEXT: CultureContext = {
  calendar: 'GregorianCalendar',
  display_name: 'English (United States)',
  locale: 'en-US',
  is_24_hour_format: true,
  timezone: 'Europe/Vienna',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  ['timezone']: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 13,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

describe('CultureContext', function () {
  it('returns formatted data correctly', function () {
    expect(getCultureContextData({data: MOCK_CULTURE_CONTEXT})).toEqual([
      {key: 'calendar', subject: 'Calendar', value: 'GregorianCalendar'},
      {
        key: 'display_name',
        subject: 'Display Name',
        value: 'English (United States)',
      },
      {key: 'locale', subject: 'Locale', value: 'en-US'},
      {key: 'is_24_hour_format', subject: 'Uses 24h Format', value: true},
      {key: 'timezone', subject: 'Timezone', value: 'Europe/Vienna'},
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {culture: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'culture'}
        alias={'culture'}
        value={{...MOCK_CULTURE_CONTEXT, timezone: ''}}
      />
    );

    expect(screen.getByText('Culture')).toBeInTheDocument();
    expect(screen.getByText('Uses 24h Format')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Timezone')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
