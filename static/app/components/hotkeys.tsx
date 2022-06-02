import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {getKeyCode} from 'sentry/utils/getKeyCode';

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
  platform?: 'macos' | string;
}) => {
  // Split by commas and then split by +, but allow escaped /+
  const byPlatform = value.split(',').map(o => o.trim().split(/(?<!\\)\+/g));

  let firstSetHasMissing = false;
  let output = byPlatform[0].map(key => {
    const [node, hasMissing] = keyToDisplay(key, platform);

    if (hasMissing) {
      firstSetHasMissing = true;
    }

    return node;
  });

  // If the first set has any missing keys that don't exist on the platform (CMD), fallback to second if exists, otherwise just go forward with current.
  if (firstSetHasMissing && byPlatform.length > 1) {
    output = byPlatform[1].map(key => keyToDisplay(key, platform)[0]);
  }

  return <HotkeysContainer>{output}</HotkeysContainer>;
};

export default Hotkeys;

const Key = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HotkeysContainer = styled('div')`
  font-family: ${p => p.theme.text.family};
  display: flex;
  flex-direction: row;
  align-items: center;

  > * {
    margin-right: ${space(1)};
  }
`;
