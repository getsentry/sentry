import {t} from 'sentry/locale';

export const OPEN_COMMAND_PALETTE_SHORTCUTS = ['mod+k', 'mod+shift+p'] as const;
export const VIEW_KEYBOARD_SHORTCUTS_SHORTCUT = 'control+shift+enter';
export const TOGGLE_NAVIGATION_SHORTCUT = 'mod+b';
export const TOGGLE_SEER_SHORTCUTS = [
  'mod+/',
  'mod+.',
  'mod+shift+7',
  'mod+shift+.',
  'mod+shift+-',
] as const;

export interface KeyboardShortcut {
  keybindings: readonly string[];
  label: string;
}

export interface KeyboardShortcutGroup {
  label: string;
  shortcuts: KeyboardShortcut[];
}

export function getKeyboardShortcutGroups(): KeyboardShortcutGroup[] {
  return [
    {
      label: t('General'),
      shortcuts: [
        {
          label: t('Open command palette'),
          keybindings: OPEN_COMMAND_PALETTE_SHORTCUTS,
        },
        {
          label: t('View keyboard shortcuts'),
          keybindings: [VIEW_KEYBOARD_SHORTCUTS_SHORTCUT],
        },
        {
          label: t('Toggle navigation'),
          keybindings: [TOGGLE_NAVIGATION_SHORTCUT],
        },
        {
          label: t('Toggle Seer'),
          keybindings: [TOGGLE_SEER_SHORTCUTS[0]],
        },
      ],
    },
    {
      label: t('Navigation'),
      shortcuts: [
        {label: t('Move through results'), keybindings: ['up', 'down']},
        {label: t('Select command'), keybindings: ['enter']},
        {label: t('Open link in new tab'), keybindings: ['shift+enter']},
        {label: t('Go back'), keybindings: ['backspace']},
        {label: t('Clear search or go back'), keybindings: ['escape']},
        {label: t('Ask Seer'), keybindings: ['tab']},
      ],
    },
  ];
}
