import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getUserContextData,
  type UserContext,
} from 'sentry/components/events/contexts/knownContext/user';

const MOCK_USER_CONTEXT: UserContext = {
  email: 'leander.rodrigues@sentry.io',
  ip_address: '127.0.0.1',
  id: '808',
  name: 'Leander',
  username: 'leeandher',
  geo: {
    country_code: 'US',
    city: 'San Francisco',
    subdivision: 'California',
    region: 'United States',
  },
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  name: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

const MOCK_SCRUBBED_REDACTION = {
  id: {
    '': {
      rem: [['project:2', 'x']],
    },
  },
  email: {
    '': {
      rem: [['project:2', 'x']],
    },
  },
  username: {
    '': {
      rem: [['project:2', 'x']],
    },
  },
  name: {
    '': {
      rem: [['project:2', 'x']],
    },
  },
  geo: {
    city: {
      '': {
        rem: [['project:2', 'x']],
      },
    },
    country_code: {
      '': {
        rem: [['project:2', 'x']],
      },
    },
  },
};

describe('UserContext', () => {
  it('returns values and according to the parameters', () => {
    expect(getUserContextData({data: MOCK_USER_CONTEXT})).toEqual([
      {
        key: 'email',
        subject: 'Email',
        value: 'leander.rodrigues@sentry.io',
        action: {link: 'mailto:leander.rodrigues@sentry.io'},
      },
      {key: 'ip_address', subject: 'IP Address', value: '127.0.0.1'},
      {key: 'id', subject: 'ID', value: '808'},
      {key: 'name', subject: 'Name', value: 'Leander'},
      {key: 'username', subject: 'Username', value: 'leeandher'},
      {
        key: 'geo',
        subject: 'Geography',
        value: 'San Francisco, California, United States (US)',
      },
      {
        key: 'extra_data',
        subject: 'data.extra_data',
        value: 'something',
        meta: undefined,
      },
      {
        key: 'unknown_key',
        subject: 'data.unknown_key',
        value: 123,
        meta: undefined,
      },
    ]);
  });

  it('renders with meta annotations correctly', () => {
    const event = EventFixture({
      _meta: {contexts: {user: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="default"
        alias="user"
        value={{...MOCK_USER_CONTEXT, name: ''}}
      />
    );

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('leander.rodrigues@sentry.io')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'leander.rodrigues@sentry.io'})
    ).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });

  it('keeps scrubbed null fields that have direct meta annotations', () => {
    const scrubbedUserContext = {
      id: null,
      email: null,
      username: null,
      name: null,
      ip_address: null,
      geo: {
        country_code: null,
        city: null,
        subdivision: null,
        region: null,
      },
    };

    const result = getUserContextData({
      data: scrubbedUserContext as unknown as UserContext,
      meta: MOCK_SCRUBBED_REDACTION,
    });

    expect(result.map(item => item.key)).toEqual(['id', 'email', 'username', 'name']);
    expect(result.every(item => item.value === null)).toBe(true);
  });

  it('renders scrubbed null fields as redacted', () => {
    const event = EventFixture({
      _meta: {user: MOCK_SCRUBBED_REDACTION},
    });

    render(
      <ContextCard
        event={event}
        type="user"
        alias="user"
        value={{
          id: null,
          email: null,
          username: null,
          name: null,
          ip_address: null,
          geo: {
            country_code: null,
            city: null,
            subdivision: null,
            region: null,
          },
        }}
      />
    );

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getAllByText(/redacted/)).toHaveLength(4);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(screen.queryByText('Geography')).not.toBeInTheDocument();
  });
});
