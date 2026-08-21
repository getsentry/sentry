import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';
import {useGlobalHotkeys} from '@sentry/scraps/hotkey';
import {useModal} from '@sentry/scraps/modal';

import {VIEW_KEYBOARD_SHORTCUTS_SHORTCUT} from 'sentry/components/keyboardShortcuts/keyboardShortcuts';
import {t} from 'sentry/locale';

import {KeyboardShortcutsDrawer} from './keyboardShortcutsDrawer';

export function useKeyboardShortcutsDrawer() {
  const {closeDrawer, openDrawer, isDrawerOpen} = useDrawer();

  const openKeyboardShortcutsDrawer = useCallback(() => {
    if (isDrawerOpen) {
      return;
    }

    openDrawer(() => <KeyboardShortcutsDrawer />, {
      ariaLabel: t('Keyboard Shortcuts'),
      drawerKey: 'keyboard-shortcuts',
      drawerWidth: '380px',
      resizable: true,
    });
  }, [isDrawerOpen, openDrawer]);

  const toggleKeyboardShortcutsDrawer = useCallback(() => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openKeyboardShortcutsDrawer();
  }, [closeDrawer, isDrawerOpen, openKeyboardShortcutsDrawer]);

  return {openKeyboardShortcutsDrawer, toggleKeyboardShortcutsDrawer};
}

export function KeyboardShortcutsHotkeys({
  toggleKeyboardShortcutsDrawer,
}: {
  toggleKeyboardShortcutsDrawer?: () => void;
}) {
  return toggleKeyboardShortcutsDrawer ? (
    <KeyboardShortcutsHotkeyHandler
      toggleKeyboardShortcutsDrawer={toggleKeyboardShortcutsDrawer}
    />
  ) : (
    <KeyboardShortcutsHotkeysWithLocalDrawer />
  );
}

function KeyboardShortcutsHotkeysWithLocalDrawer() {
  const {toggleKeyboardShortcutsDrawer} = useKeyboardShortcutsDrawer();
  return (
    <KeyboardShortcutsHotkeyHandler
      toggleKeyboardShortcutsDrawer={toggleKeyboardShortcutsDrawer}
    />
  );
}

function KeyboardShortcutsHotkeyHandler({
  toggleKeyboardShortcutsDrawer,
}: {
  toggleKeyboardShortcutsDrawer: () => void;
}) {
  const {closeModal, visible} = useModal();

  useGlobalHotkeys([
    {
      match: VIEW_KEYBOARD_SHORTCUTS_SHORTCUT,
      includeInputs: true,
      callback: () => {
        if (visible) {
          closeModal();
        }
        toggleKeyboardShortcutsDrawer();
      },
    },
  ]);

  return null;
}
