import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {getKeyCode} from 'sentry/utils/getKeyCode';

interface KeyboardKeyProps {
  /** The key or key name to display */
  keyName: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
}

const KEY_SYMBOLS: Record<string, string> = {
  command: '⌘',
  cmd: '⌘',
  meta: '⌘',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  ctrl: '⌃',
  control: '⌃',
  enter: '⏎',
  return: '⏎',
  escape: 'esc',
  esc: 'esc',
  space: '⎵',
  backspace: '⌫',
  delete: '⌦',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  tab: '⇥',
};

/**
 * Component to display a keyboard key with proper styling
 */
export function KeyboardKey({keyName, size = 'sm'}: KeyboardKeyProps) {
  // Check if we have a symbol for this key
  const displayKey = KEY_SYMBOLS[keyName.toLowerCase()] || keyName.toUpperCase();

  // For single letters, always show uppercase
  const finalDisplay = displayKey.length === 1 ? displayKey.toUpperCase() : displayKey;

  return <StyledKey size={size}>{finalDisplay}</StyledKey>;
}

interface KeyboardShortcutProps {
  /** The full shortcut combination (e.g., "cmd+k" or "g i") */
  shortcut: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Component to display a full keyboard shortcut
 */
export function KeyboardShortcut({shortcut, size = 'sm'}: KeyboardShortcutProps) {
  // Handle sequential shortcuts (e.g., "g i")
  if (shortcut.includes(' ')) {
    const parts = shortcut.split(' ');
    return (
      <ShortcutContainer>
        {parts.map((part, index) => (
          <span key={index}>
            <KeyboardKey keyName={part} size={size} />
            {index < parts.length - 1 && <ThenText>then</ThenText>}
          </span>
        ))}
      </ShortcutContainer>
    );
  }

  // Handle combined shortcuts (e.g., "cmd+k")
  const keys = shortcut.split('+');

  return (
    <ShortcutContainer>
      {keys.map((key, index) => (
        <span key={index}>
          <KeyboardKey keyName={key} size={size} />
          {index < keys.length - 1 && '+'}
        </span>
      ))}
    </ShortcutContainer>
  );
}

const sizeStyles = {
  xs: {
    fontSize: '11px',
    padding: `1px ${space(0.5)}`,
    minWidth: '18px',
  },
  sm: {
    fontSize: '12px',
    padding: `2px ${space(0.75)}`,
    minWidth: '24px',
  },
  md: {
    fontSize: '14px',
    padding: `4px ${space(1)}`,
    minWidth: '32px',
  },
};

const StyledKey = styled('kbd')<{size: KeyboardKeyProps['size']}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  ${p => sizeStyles[p.size || 'sm']};
  background: ${p => p.theme.gray100};
  border: 1px solid ${p => p.theme.gray200};
  border-radius: 3px;
  box-shadow: 0 1px 0 ${p => p.theme.gray200};
  color: ${p => p.theme.gray500};
  font-family: ${p => p.theme.text.familyMono};
  font-weight: 600;
  line-height: 1;
  text-align: center;
  user-select: none;
  white-space: nowrap;

  /* Platform-specific adjustments */
  @media (prefers-color-scheme: dark) {
    background: ${p => p.theme.gray300};
    border-color: ${p => p.theme.gray400};
    box-shadow: 0 1px 0 ${p => p.theme.gray400};
    color: ${p => p.theme.gray100};
  }
`;

const ShortcutContainer = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ThenText = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: 0.9em;
  font-style: italic;
  margin: 0 ${space(0.5)};
`;
