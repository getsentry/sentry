import {formatHotkey} from '@sentry/scraps/hotkey';

jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

describe('formatHotkey', () => {
  describe('mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(true);
    });

    it('formats Mod as ⌘ without separators', () => {
      expect(formatHotkey('Mod+K')).toBe('\u2318K');
    });

    it('formats multiple modifiers in platform order', () => {
      expect(formatHotkey('Mod+Shift+P')).toBe('\u21E7\u2318P');
    });

    it('uses the first combo from an array', () => {
      expect(formatHotkey(['Mod+Backspace', 'Delete'])).toBe('\u2318\u232B');
    });
  });

  describe('non-mac platform', () => {
    beforeEach(() => {
      isMac.mockReturnValue(false);
    });

    it('formats Mod as Ctrl separated by spaces', () => {
      expect(formatHotkey('Mod+K')).toBe('Ctrl K');
    });

    it('applies custom key labels', () => {
      expect(formatHotkey('Control+Alt+Delete')).toBe('Ctrl Alt Del');
    });
  });

  it('returns an empty string for an empty array', () => {
    expect(formatHotkey([])).toBe('');
  });
});
