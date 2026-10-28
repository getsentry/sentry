import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {Hotkey} from '@sentry/scraps/hotkey';
import {lightTheme} from '@sentry/scraps/theme';

jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Hotkey', () => {
  describe('mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('renders command as ⌘ icon', () => {
      render(<Hotkey value="command+k" />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders ctrl as ⌃ icon', () => {
      render(<Hotkey value="ctrl+alt+delete" />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u2303')).toBeInTheDocument();
      expect(screen.getByLabelText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('Del')).toBeInTheDocument();
    });

    it('renders option as ⌥ icon', () => {
      render(<Hotkey value="option+x" />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u2325')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });
  });

  describe('non-mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(false);
    });

    it('renders command as Ctrl text', () => {
      render(<Hotkey value="command+k" />, {wrapper: ThemeWrapper});
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('renders ctrl as Ctrl text', () => {
      render(<Hotkey value="ctrl+alt+delete" />, {wrapper: ThemeWrapper});
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('Alt')).toBeInTheDocument();
      expect(screen.getByText('Del')).toBeInTheDocument();
    });

    it('renders option as Alt text', () => {
      render(<Hotkey value="option+x" />, {wrapper: ThemeWrapper});
      expect(screen.getByText('Alt')).toBeInTheDocument();
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    it('renders shift as ⇧ icon', () => {
      render(<Hotkey value="shift+up" />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u21E7')).toBeInTheDocument();
      expect(screen.getByLabelText('\u2191')).toBeInTheDocument();
    });
  });

  describe('string input', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('accepts a single string', () => {
      render(<Hotkey value="command+/" />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('array input', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('uses first combo from array', () => {
      render(<Hotkey value={['command+backspace', 'delete']} />, {wrapper: ThemeWrapper});
      expect(screen.getByLabelText('\u2318')).toBeInTheDocument();
      expect(screen.getByText('\u232B')).toBeInTheDocument();
    });
  });

  describe('semantic HTML', () => {
    it('renders nested kbd elements', () => {
      render(<Hotkey value="command+k" />, {wrapper: ThemeWrapper});
      // Keyboard keys have no implicit ARIA role.
      // eslint-disable-next-line testing-library/no-node-access
      const kbdElements = document.querySelectorAll('kbd');
      // Outer wrapper + 2 inner keys
      expect(kbdElements).toHaveLength(3);
    });
  });
});
