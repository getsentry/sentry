import {css, type Theme} from '@emotion/react';

/**
 * The two shapes a key/value row comes in.
 *
 * - `sidebar` is the narrow spec-sheet look: short values (dates, versions,
 *   counts) flushed right, sans, truncated rather than wrapped, because a
 *   wrapping value would blow out the height of the column it sits in.
 * - `body` is the full-width data look: long values that must wrap, mono,
 *   left-aligned.
 */
export type KeyValueTablePreset = 'sidebar' | 'body';

interface PresetTokens {
  align: 'start' | 'end';
  fontFamily: 'mono' | 'sans';
  fontSize: 'sm' | 'md';
  overflow: 'truncate' | 'wrap';
  paddingX: 'sm' | 'md';
  paddingY: '2xs' | 'xs';
}

const PRESETS: Record<KeyValueTablePreset, PresetTokens> = {
  sidebar: {
    align: 'end',
    fontFamily: 'sans',
    fontSize: 'md',
    overflow: 'truncate',
    paddingX: 'md',
    paddingY: 'xs',
  },
  body: {
    align: 'start',
    fontFamily: 'mono',
    fontSize: 'sm',
    overflow: 'wrap',
    paddingX: 'sm',
    paddingY: '2xs',
  },
};

/**
 * Row backgrounds default to flat. `striped` is retained for wide tables with
 * many rows, where the eye has to track horizontally from key to value and
 * alternating bands genuinely help — Packages, the Contexts grid, Feature Flags.
 */
export interface KeyValueTableRowState {
  hasErrors?: boolean;
  isSuspect?: boolean;
  striped?: boolean;
}

/**
 * The error/suspect tint, shared by every variant so `red100` and `yellow100`
 * have one definition. Returns nothing for an untinted row, leaving the
 * background to the container (which owns striping).
 */
export function rowTint({
  theme,
  hasErrors,
  isSuspect,
}: Pick<KeyValueTableRowState, 'hasErrors' | 'isSuspect'> & {theme: Theme}) {
  const tint = hasErrors
    ? theme.colors.red100
    : isSuspect
      ? theme.colors.yellow100
      : null;

  if (!tint) {
    return null;
  }

  return css`
    background-color: ${tint} !important;
  `;
}

export function rowContent({
  theme,
  hasErrors,
  isSuspect,
}: Pick<KeyValueTableRowState, 'hasErrors' | 'isSuspect'> & {theme: Theme}) {
  if (hasErrors) {
    return theme.colors.red500;
  }
  if (isSuspect) {
    return theme.colors.yellow500;
  }
  return theme.tokens.content.secondary;
}

export function presetTypography({
  theme,
  preset,
}: {
  preset: KeyValueTablePreset;
  theme: Theme;
}) {
  const tokens = PRESETS[preset];

  return css`
    font-family: ${theme.font.family[tokens.fontFamily]};
    font-size: ${theme.font.size[tokens.fontSize]};
    padding: ${theme.space[tokens.paddingY]} ${theme.space[tokens.paddingX]};
    text-align: ${tokens.align};
    ${
      tokens.overflow === 'truncate'
        ? css`
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `
        : css`
            word-break: break-word;
          `
    }
  `;
}
