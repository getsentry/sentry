import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {EventOrGroupType} from 'sentry/types/event';

import EventMessage from './eventMessage';

describe('EventMessage', () => {
  const defaultUser = UserFixture();

  beforeEach(() => {
    ConfigStore.init();
  });

  it('renders error message', () => {
    render(<EventMessage message="Test message" type={EventOrGroupType.ERROR} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders "No error message" when message is not provided', () => {
    render(<EventMessage message={null} type={EventOrGroupType.ERROR} />);
    expect(screen.getByText('(No error message)')).toBeInTheDocument();
  });

  it('renders error level indicator dot', () => {
    render(
      <EventMessage message="Test message" type={EventOrGroupType.ERROR} level="error" />
    );
    expect(screen.getByText('Level: Error')).toBeInTheDocument();
  });

  it('renders error level indicator text', () => {
    ConfigStore.set(
      'user',
      UserFixture({
        ...defaultUser,
        options: {
          ...defaultUser.options,
          prefersIssueDetailsStreamlinedUI: true,
        },
      })
    );
    render(
      <EventMessage message="Test message" type={EventOrGroupType.ERROR} level="error" />
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders unhandled tag', () => {
    render(
      <EventMessage message="Test message" type={EventOrGroupType.ERROR} showUnhandled />
    );
    expect(screen.getByText('Unhandled')).toBeInTheDocument();
  });
});
