export type CssSize = number | `${number}px` | `1em` | '100%';

/**
 * Convert a number into a `${number}px` value
 * Or, if the input is a string (as returned from `space(number)`), return it directly.
 */
export default function toPixels(val: CssSize | undefined) {
  return typeof val === 'string' ? val : typeof val === 'number' ? val + 'px' : undefined;
}
