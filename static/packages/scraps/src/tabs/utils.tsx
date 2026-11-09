import type {MouseEvent, PointerEvent} from 'react';
import isPropValid from '@emotion/is-prop-valid';

export const tabsShouldForwardProp = (prop: string) =>
  typeof prop === 'string' && isPropValid(prop) && prop !== 'orientation';

export function isModifiedClick(event: MouseEvent | PointerEvent) {
  return (
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  );
}
