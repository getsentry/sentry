import {render, screen} from 'sentry-test/reactTestingLibrary';

import HotkeysLabel from 'sentry/components/hotkeysLabel';

describe('HotkeysLabel', function () {
  it('ctrl+alt+delete mac', function () {
    render(<HotkeysLabel value={['ctrl+alt+delete']} forcePlatform="macos" />);
    expect(screen.getByText('⌃')).toBeInTheDocument();
    expect(screen.getByText('⌥')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
  });

  it('ctrl+alt+delete windows', function () {
    render(<HotkeysLabel value={['ctrl+alt+delete']} forcePlatform="generic" />);
    expect(screen.getByText('CTRL')).toBeInTheDocument();
    expect(screen.getByText('ALT')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
  });

  it('falls back when not on mac', function () {
    render(<HotkeysLabel value={['cmd', 'alt']} forcePlatform="generic" />);
    expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    expect(screen.queryByText('CMD')).not.toBeInTheDocument();

    expect(screen.getByText('ALT')).toBeInTheDocument();
  });

  it('does not render at all without fallback', function () {
    render(<HotkeysLabel value={['cmd+k', 'cmd+alt+l']} forcePlatform="generic" />);
    expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    expect(screen.queryByText('L')).not.toBeInTheDocument();
    expect(screen.queryByText('ALT')).not.toBeInTheDocument();
  });

  it('takes just a string', function () {
    render(<HotkeysLabel value="option" forcePlatform="generic" />);
    expect(screen.getByText('ALT')).toBeInTheDocument();
  });
});
