function isReactEvent(
  maybe: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent
): maybe is React.MouseEvent | React.TouchEvent {
  return 'nativeEvent' in maybe;
}

/**
 * Handle getting position out of both React and Raw DOM events
 * as both are handled here due to mousedown/mousemove events
 * working differently.
 */
export function getPointerPosition(
  event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  property: 'pageX' | 'pageY' | 'clientX' | 'clientY'
): number {
  const actual = isReactEvent(event) ? event.nativeEvent : event;
  if (window.TouchEvent && actual instanceof TouchEvent) {
    return actual.targetTouches[0]![property];
  }
  if (actual instanceof MouseEvent) {
    return actual[property];
  }
  return 0;
}
