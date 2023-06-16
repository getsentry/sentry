import {isAppleDevice, isMac} from '@react-aria/utils';

/**
 * Whether a modifier key (ctrl/alt/shift) is being pressed. Based on
 * https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/selection/src/utils.ts
 */
export function isModifierKeyPressed(e: React.KeyboardEvent<HTMLDivElement>) {
  return (
    (isAppleDevice() ? e.altKey : e.ctrlKey) || // contiguous selection modifier
    (isMac() ? e.metaKey : e.ctrlKey) || // ctrl key
    e.shiftKey
  );
}
