import type {CSSProperties} from 'react';

export function getBorderBoxAnchoredOverlayStyle(reference: HTMLElement): CSSProperties {
  const style = getComputedStyle(reference);
  const borderLeftWidth = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRightWidth = Number.parseFloat(style.borderRightWidth) || 0;

  return {
    left: -borderLeftWidth,
    width: `calc(100% + ${borderLeftWidth + borderRightWidth}px)`,
  };
}
