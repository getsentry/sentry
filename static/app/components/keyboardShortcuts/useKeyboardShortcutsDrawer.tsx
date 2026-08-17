import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';

import {KeyboardShortcutsDrawer} from './keyboardShortcutsDrawer';

export function useKeyboardShortcutsDrawer() {
  const {openDrawer, isDrawerOpen} = useDrawer();

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

  return {openKeyboardShortcutsDrawer};
}
