import styled from '@emotion/styled';

import space from 'sentry/styles/space';

/* key maps and utils retrieved from  https://github.com/jaywcjlove/hotkeys */

const _keyMap = {
  backspace: 8,
  tab: 9,
  clear: 12,
  enter: 13,
  return: 13,
  esc: 27,
  escape: 27,
  space: 32,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  del: 46,
  delete: 46,
  ins: 45,
  insert: 45,
  home: 36,
  end: 35,
  pageup: 33,
  pagedown: 34,
  capslock: 20,
  num_0: 96,
  num_1: 97,
  num_2: 98,
  num_3: 99,
  num_4: 100,
  num_5: 101,
  num_6: 102,
  num_7: 103,
  num_8: 104,
  num_9: 105,
  num_multiply: 106,
  num_add: 107,
  num_enter: 108,
  num_subtract: 109,
  num_decimal: 110,
  num_divide: 111,
  '⇪': 20,
  ',': 188,
  '.': 190,
  '/': 191,
  '`': 192,
  '-': 189,
  '=': 187,
  ';': 186,
  "'": 222,
  '[': 219,
  ']': 221,
  '\\': 220,

  // special case for escaped +
  '\\+': 9999,
};

// Modifier Keys
const _modifier = {
  // shiftKey
  '⇧': 16,
  shift: 16,
  // altKey
  '⌥': 18,
  alt: 18,
  option: 18,
  // ctrlKey
  '⌃': 17,
  ctrl: 17,
  control: 17,
  // metaKey
  '⌘': 91,
  cmd: 91,
  command: 91,
};

const macModifiers = {
  18: '⌥',
  17: '⌃',
  91: '⌘',
};

const normalModifiers = {
  18: 'ALT',
  17: 'CTRL',
  91: 'CMD',
};

const genericGlyphs = {
  16: '⇧',
  8: '⌫',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  9999: '+',
};

const getKeyCode = (x: string): string | undefined =>
  _keyMap[x.toLowerCase()] || _modifier[x.toLowerCase()];

const keyToDisplay = (
  key: string,
  platform?: 'macos' | string
): [React.ReactNode, boolean] => {
  let keyStr = key.toUpperCase();
  let hasMissing = false;

  const keyCode = getKeyCode(key);
  if (keyCode) {
    const isMac = platform
      ? platform === 'macos'
      : window?.navigator?.platform?.toLowerCase().startsWith('mac') ?? false;

    if (isMac) {
      const modifier = macModifiers[keyCode];
      if (modifier) {
        keyStr = modifier;
      }
    } else {
      const modifier = normalModifiers[keyCode];
      if (modifier) {
        if (modifier === 'CMD') {
          hasMissing = true;
        }
        keyStr = modifier;
      }
    }

    const glyph = genericGlyphs[keyCode];

    if (glyph) {
      keyStr = glyph;
    }
  }

  // eslint-disable-next-line react/jsx-key
  return [<Key>{keyStr}</Key>, hasMissing];
};

const Hotkeys = ({
  value,
  platform,
  hideOnMobile,
}: {
  /**
   * Pass key combinations in with + as the separator.
   * For example: command+option+x
   *
   * Use comma for fallback key combos when the first one contains a key that does not exist on that os (non-mac):
   * command+option+x,ctrl+shift+x
   * (does not have to be the same combo)
   *
   * Escape the + key with a slash |+
   */
  value: string;
  hideOnMobile?: boolean;
  platform?: 'macos' | string;
}) => {
  const byOs = value.split(',').map(o => o.trim().split(/(?<!\\)\+/g));

  let hasMissing_ = false;
  let output = byOs[0].map(key => {
    const [node, hasMissing] = keyToDisplay(key, platform);

    if (hasMissing) {
      hasMissing_ = true;
    }

    return node;
  });

  if (hasMissing_ && byOs.length > 1) {
    output = byOs[1].map(key => keyToDisplay(key, platform)[0]);
  }

  return <HotkeysContainer hideOnMobile={hideOnMobile}>{output}</HotkeysContainer>;
};

export default Hotkeys;

const Key = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HotkeysContainer = styled('div')<{hideOnMobile?: boolean}>`
  font-family: ${p => p.theme.text.family};
  display: flex;
  flex-direction: row;
  align-items: center;

  > * {
    margin-right: ${space(1)};
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: ${p => (p.hideOnMobile ? 'none' : 'flex')};
  }
`;
