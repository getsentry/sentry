import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Hotkey} from '@sentry/scraps/hotkey';

jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

describe('Hotkey', () => {
  describe('mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('renders command as ⌘', () => {
      render(<Hotkey value="command+k" />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders ctrl as ⌃', () => {
      render(<Hotkey value="ctrl+alt+delete" />);
      expect(screen.getByText('\u2303')).toBeInTheDocument();
      expect(screen.getByText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('DEL')).toBeInTheDocument();
    });

    it('renders option as ⌥', () => {
      render(<Hotkey value="option+x" />);
      expect(screen.getByText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });
  });

  describe('non-mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(false);
    });

    it('renders command as CTRL', () => {
      render(<Hotkey value="command+k" />);
      expect(screen.getByText('CTRL')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders ctrl as CTRL', () => {
      render(<Hotkey value="ctrl+alt+delete" />);
      expect(screen.getByText('CTRL')).toBeInTheDocument();
      expect(screen.getByText('ALT')).toBeInTheDocument();
      expect(screen.getByText('DEL')).toBeInTheDocument();
    });

    it('renders option as ALT', () => {
      render(<Hotkey value="option+x" />);
      expect(screen.getByText('ALT')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    it('renders shift as ⇧', () => {
      render(<Hotkey value="shift+up" />);
      expect(screen.getByText('\u21e7')).toBeInTheDocument();
      expect(screen.getByText('\u2191')).toBeInTheDocument();
    });
  });

  describe('string input', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('accepts a single string', () => {
      render(<Hotkey value="command+/" />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('array input', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('uses first combo from array', () => {
      render(<Hotkey value={['command+backspace', 'delete']} />);
      expect(screen.getByText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('\u232b')).toBeInTheDocument();
    });
  });

  describe('semantic HTML', () => {
    it('renders nested kbd elements', () => {
      render(<Hotkey value="command+k" />);
      const kbdElements = document.querySelectorAll('kbd');
      // Outer wrapper + 2 inner keys
      expect(kbdElements).toHaveLength(3);
    });
  });
});
