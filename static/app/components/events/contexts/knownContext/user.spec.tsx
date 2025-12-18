import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
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

describe('UserContext', () => {
  it('returns values and according to the parameters', () => {
    const result = getUserContextData({data: MOCK_USER_CONTEXT});

    // Extract the actionButton from the email item for comparison
    const emailItem = result.find(item => item.key === 'email');
    const {actionButton, ...emailItemWithoutButton} = emailItem || {};

    expect(
      result.map(item => {
        if (item.key === 'email') {
          const {actionButton: _, ...rest} = item;
          return rest;
        }
        return item;
      })
    ).toEqual([
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

    // Verify actionButton exists for email
    expect(actionButton).toBeDefined();
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

  it('allows copying email to clipboard', async () => {
    const mockCopy = jest.fn().mockResolvedValue('');
    Object.assign(navigator, {
      clipboard: {
        writeText: mockCopy,
      },
    });

    const event = EventFixture();
    render(
      <ContextCard event={event} type="default" alias="user" value={MOCK_USER_CONTEXT} />
    );

    const copyButton = screen.getByRole('button', {name: 'Copy email to clipboard'});
    await userEvent.click(copyButton);
    expect(mockCopy).toHaveBeenCalledWith('leander.rodrigues@sentry.io');
  });
});
