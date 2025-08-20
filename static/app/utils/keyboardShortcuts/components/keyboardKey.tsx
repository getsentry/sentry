import React from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

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

// Mapping of keys to their shifted equivalents
const SHIFTED_CHARACTERS: Record<string, string> = {
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
  '-': '_',
  '=': '+',
  '[': '{',
  ']': '}',
  '\\': '|',
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
  '`': '~',
};

/**
 * Component to display a keyboard key with proper styling
 */
export function KeyboardKey({keyName, size = 'sm'}: KeyboardKeyProps) {
  // Check if we have a symbol for this key
  const normalizedKey = keyName.toLowerCase();

  if (KEY_SYMBOLS[normalizedKey]) {
    return <StyledKey size={size}>{KEY_SYMBOLS[normalizedKey]}</StyledKey>;
  }

  // For single characters, show lowercase unless it's a special case
  if (keyName.length === 1) {
    // Check if this is already an uppercase letter or shifted character
    const isUppercase = keyName >= 'A' && keyName <= 'Z';
    const isShiftedChar = Object.values(SHIFTED_CHARACTERS).includes(keyName);

    if (isUppercase || isShiftedChar) {
      return <StyledKey size={size}>{keyName}</StyledKey>;
    }

    // Default to lowercase for single letters
    return <StyledKey size={size}>{keyName.toLowerCase()}</StyledKey>;
  }

  // For multi-character keys, preserve original casing
  return <StyledKey size={size}>{keyName}</StyledKey>;
}

interface KeyboardShortcutProps {
  /** The full shortcut combination (e.g., "cmd+k" or "g i") */
  shortcut: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Helper function to render a key combination without recursion
 */
function renderKeyCombination(combination: string, size: KeyboardKeyProps['size']) {
  const keys = combination.split('+');

  // Check if this is a shift combination with a single character/symbol
  const shiftIndex = keys.findIndex(key => key.toLowerCase() === 'shift');
  if (shiftIndex !== -1 && keys.length === 2) {
    const otherKey = keys[shiftIndex === 0 ? 1 : 0];

    if (!otherKey) {
      // Fallback if key is undefined
      return (
        <React.Fragment>
          {keys.map((key, index) => (
            <span key={index}>
              <KeyboardKey keyName={key} size={size} />
              {index < keys.length - 1 && '+'}
            </span>
          ))}
        </React.Fragment>
      );
    }

    // If the other key has a shifted equivalent, show that instead
    const shiftedChar = SHIFTED_CHARACTERS[otherKey.toLowerCase()];
    if (shiftedChar) {
      return <KeyboardKey keyName={shiftedChar} size={size} />;
    }

    // For letters with shift, show uppercase
    if (otherKey.length === 1 && /[a-zA-Z]/.test(otherKey)) {
      return <KeyboardKey keyName={otherKey.toUpperCase()} size={size} />;
    }
  }

  // Default behavior for other combinations
  return (
    <React.Fragment>
      {keys.map((key, index) => (
        <span key={index}>
          <KeyboardKey keyName={key} size={size} />
          {index < keys.length - 1 && '+'}
        </span>
      ))}
    </React.Fragment>
  );
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
            {renderKeyCombination(part, size)}
            {index < parts.length - 1 && <ThenText>then</ThenText>}
          </span>
        ))}
      </ShortcutContainer>
    );
  }

  // Handle single combinations
  return <ShortcutContainer>{renderKeyCombination(shortcut, size)}</ShortcutContainer>;
}

const sizeStyles = {
  xs: {
    fontSize: '11px',
    padding: `1px ${(p: any) => p.theme.space.xs}`,
    minWidth: '18px',
  },
  sm: {
    fontSize: '12px',
    padding: `2px ${(p: any) => p.theme.space.sm}`,
    minWidth: '24px',
  },
  md: {
    fontSize: '14px',
    padding: `4px ${(p: any) => p.theme.space.md}`,
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
