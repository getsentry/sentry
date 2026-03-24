import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Hotkey} from '@sentry/scraps/hotkey';

describe('Hotkey', () => {
  describe('auto platform mapping', () => {
    it('renders command as ⌘ on mac', () => {
      render(<Hotkey value="command+k" forcePlatform="macos" />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders command as CTRL on non-mac', () => {
      render(<Hotkey value="command+k" forcePlatform="generic" />);
      expect(screen.getByText('CTRL')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders ctrl as ⌃ on mac', () => {
      render(<Hotkey value="ctrl+alt+delete" forcePlatform="macos" />);
      expect(screen.getByText('\u2303')).toBeInTheDocument();
      expect(screen.getByText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('DEL')).toBeInTheDocument();
    });

    it('renders ctrl as CTRL on non-mac', () => {
      render(<Hotkey value="ctrl+alt+delete" forcePlatform="generic" />);
      expect(screen.getByText('CTRL')).toBeInTheDocument();
      expect(screen.getByText('ALT')).toBeInTheDocument();
      expect(screen.getByText('DEL')).toBeInTheDocument();
    });

    it('renders shift as ⇧ on all platforms', () => {
      render(<Hotkey value="shift+up" forcePlatform="generic" />);
      expect(screen.getByText('\u21e7')).toBeInTheDocument();
      expect(screen.getByText('\u2191')).toBeInTheDocument();
    });

    it('renders option as ⌥ on mac', () => {
      render(<Hotkey value="option+x" forcePlatform="macos" />);
      expect(screen.getByText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    it('renders option as ALT on non-mac', () => {
      render(<Hotkey value="option+x" forcePlatform="generic" />);
      expect(screen.getByText('ALT')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });
  });

  describe('string input', () => {
    it('accepts a single string', () => {
      render(<Hotkey value="command+/" forcePlatform="macos" />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('array input', () => {
    it('uses first combo from array', () => {
      render(<Hotkey value={['command+backspace', 'delete']} forcePlatform="macos" />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('\u232b')).toBeInTheDocument();
    });
  });

  describe('semantic HTML', () => {
    it('renders nested kbd elements', () => {
      render(<Hotkey value="command+k" forcePlatform="macos" />);
      const kbdElements = document.querySelectorAll('kbd');
      // Outer wrapper + 2 inner keys
      expect(kbdElements).toHaveLength(3);
    });
  });
});
