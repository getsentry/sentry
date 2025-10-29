import type {
  CommandPaletteActionCallback,
  CommandPaletteActionGroup,
  CommandPaletteActionLink,
} from 'sentry/components/commandPalette/types';

export function makeCommandPaletteLink(
  options: Omit<CommandPaletteActionLink, 'type'>
): CommandPaletteActionLink {
  return {
    ...options,
    type: 'navigate',
  };
}

export function makeCommandPaletteCallback(
  options: Omit<CommandPaletteActionCallback, 'type'>
): CommandPaletteActionCallback {
  return {
    ...options,
    type: 'callback',
  };
}

export function makeCommandPaletteGroup(
  options: Omit<CommandPaletteActionGroup, 'type'>
): CommandPaletteActionGroup {
  return {
    ...options,
    type: 'group',
  };
}
