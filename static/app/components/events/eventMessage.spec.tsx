import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {EventOrGroupType} from 'sentry/types/event';

import {EventMessage} from './eventMessage';

describe('EventMessage', () => {
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

  it('renders unhandled tag', () => {
    render(
      <EventMessage message="Test message" type={EventOrGroupType.ERROR} showUnhandled />
    );
    expect(screen.getByText('Unhandled')).toBeInTheDocument();
  });

  it('renders colored text without escape codes when given an ANSI message', () => {
    const message = '\x1B[31mfailed\x1B[0m to connect';

    render(<EventMessage message={message} type={EventOrGroupType.ERROR} />);

    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('failed').parentElement).toHaveTextContent(
      /^failed to connect$/
    );
  });
});
