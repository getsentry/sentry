import type * as React from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {IconCommand} from '@sentry/icons/command';
import {IconControl} from '@sentry/icons/control';
import {IconOption} from '@sentry/icons/option';
import {IconReturn} from '@sentry/icons/return';
import {IconShift} from '@sentry/icons/shift';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

type KeyGlyph = {icon: React.ReactNode; label: string} | {label: string};
const sharedProps = {size: 'xs'} satisfies SVGIconProps;
const shiftGlyph = {icon: <IconShift {...sharedProps} />, label: '⇧'};

// Replace TanStack's display labels with Sentry's key icons.
const glyphs: Record<string, KeyGlyph> = {
  '⌘': {icon: <IconCommand {...sharedProps} />, label: '⌘'},
  '⌃': {icon: <IconControl {...sharedProps} />, label: '⌃'},
  '⌥': {icon: <IconOption {...sharedProps} />, label: '⌥'},
  '⇧': shiftGlyph,
  Shift: shiftGlyph,
  '↵': {icon: <IconReturn {...sharedProps} />, label: '↵'},
  '←': {icon: <IconArrow {...sharedProps} direction="left" />, label: '←'},
  '→': {icon: <IconArrow {...sharedProps} direction="right" />, label: '→'},
  '↑': {icon: <IconArrow {...sharedProps} direction="up" />, label: '↑'},
  '↓': {icon: <IconArrow {...sharedProps} direction="down" />, label: '↓'},
};

export function resolveKeyGlyph(label: string): KeyGlyph {
  return glyphs[label] ?? {label};
}
