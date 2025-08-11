import {isMac} from '@react-aria/utils';

/**
 * Whether the ctrl key (for Windows) or the meta key (for Mac) is being pressed.
 * Useful for checking for hotkeys like copy, paste, select-all, etc.
 *
 * Same as the un-exported util function in react-spectrum [1].
 *
 * [1] https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/selection/src/utils.ts
 */
export function isCtrlKeyPressed(e: React.KeyboardEvent | React.MouseEvent) {
  if (isMac()) {
    return e.metaKey;
  }

  return e.ctrlKey;
}
