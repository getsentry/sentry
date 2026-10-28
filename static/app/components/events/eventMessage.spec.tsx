import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {EventOrGroupType} from 'sentry/types/event';

import {EventMessage} from './eventMessage';

describe('EventMessage', () => {
  beforeEach(() => {
    ConfigStore.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('shows the full message in a tooltip when it is truncated', async () => {
    // JSDOM reports 0 for layout sizes, so simulate a truncated message
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);

    const message = 'Video failed to load: https://example.com/a/very/long/url';
    render(<EventMessage message={message} type={EventOrGroupType.ERROR} />);

    await userEvent.hover(screen.getByText(message));

    expect(await screen.findAllByText(message)).toHaveLength(2);
  });
});
