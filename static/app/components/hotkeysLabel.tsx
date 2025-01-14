import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import toArray from 'sentry/utils/array/toArray';
import {getKeyCode} from 'sentry/utils/getKeyCode';

const macModifiers = {
  18: '⌥',
  17: '⌃',
  91: '⌘',
};

const normalModifiers = {
  18: 'ALT',
  17: 'CTRL',
};

const genericGlyphs = {
  16: '⇧',
  8: '⌫',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  107: '+',
};

const keyToDisplay = (
  key: string,
  isMac: boolean
): {label: React.ReactNode; specificToOs: 'macos' | 'generic'} => {
  const keyCode = getKeyCode(key);

  // Not a special key
  if (!keyCode) {
    return {label: <Key>{key.toUpperCase()}</Key>, specificToOs: 'generic'};
  }

  const modifierMap = isMac ? macModifiers : normalModifiers;
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const keyStr = modifierMap[keyCode] ?? genericGlyphs[keyCode] ?? key.toUpperCase();

  const specificToOs = keyCode === getKeyCode('command') ? 'macos' : 'generic';

  return {label: <Key key={keyStr}>{keyStr}</Key>, specificToOs};
};

type Props = {
  /**
   * Pass key combinations in with + as the separator.
   * For example: `'command+option+x'`
   *
   * Pass an array of strings for fallback key combos when the first one contains a key that does not exist on that os (non-mac):
   * `['command+option+x', 'ctrl+shift+x']`
   * (does not have to be the same combo)
   */
  value: string[] | string;
  forcePlatform?: 'macos' | 'generic';
};

function HotkeysLabel({value, forcePlatform}: Props) {
  // Split by commas and then split by +, but allow escaped /+
  const hotkeySets = toArray(value).map(o => o.trim().split('+'));

  const isMac = forcePlatform
    ? forcePlatform === 'macos'
    : window?.navigator?.platform?.toLowerCase().startsWith('mac') ?? false;

  // If we're not using mac find the first key set that is generic.
  // Otherwise show whatever the first hotkey is.
  const finalKeySet = hotkeySets
    .map(keySet => keySet.map(key => keyToDisplay(key, isMac)))
    .find(keySet =>
      !isMac ? keySet.every(key => key.specificToOs === 'generic') : true
    );

  // No key available for the OS. Don't show a hotkey
  if (finalKeySet === undefined) {
    return null;
  }

  return <HotkeysContainer>{finalKeySet.map(key => key.label)}</HotkeysContainer>;
}

export default HotkeysLabel;

const Key = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HotkeysContainer = styled('div')`
  font-family: ${p => p.theme.text.family};
  display: flex;
  flex-direction: row;
  align-items: center;

  > * {
    margin-right: ${space(0.5)};
  }
`;
