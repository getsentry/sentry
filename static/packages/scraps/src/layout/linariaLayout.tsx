import type {CSSProperties} from 'react';

import {
  baseStyles,
  breakpointStyles,
  breakpointVarSuffix,
  fixedStyles,
  type LayoutProperty,
} from './generatedStyles';
import type {Responsive, ResponsiveKey} from './styles';

/**
 * The Linaria counterpart of `rc()`: turns layout props into class names (and,
 * for values without a static class, inline custom properties) instead of
 * serializing CSS at runtime.
 *
 * Each layout prop adds one base class and optional breakpoint classes.
 */
export interface LayoutStyle {
  classNames: string[];
  /**
   * Also set plain (non-responsive) values as inline styles. Used for the
   * render-prop form, where the styles land on the caller's element: with
   * Emotion, layout props were composed after that element's own (often
   * Emotion) styles and won, while classes from an earlier stylesheet lose to
   * them. Classes are still added for callers that replace `style`.
   */
  inline: boolean;
  style: Record<string, string> | undefined;
}

export function createLayoutStyle(inline = false): LayoutStyle {
  return {classNames: [], inline, style: undefined};
}

// Same cascade order as `rc()`: the container axis, then the viewport axis.
const RESPONSIVE_KEYS: readonly ResponsiveKey[] = [
  'zero',
  '3xs',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  'screen:2xs',
  'screen:xs',
  'screen:sm',
  'screen:md',
  'screen:lg',
  'screen:xl',
  'screen:2xl',
];

/** Must match `layoutVarName` in scripts/genLinariaTheme.ts. */
function layoutVarName(property: LayoutProperty, key?: ResponsiveKey): string {
  return key ? `--ln-${property}-${breakpointVarSuffix[key]}` : `--ln-${property}`;
}

type CompiledStyle = string;

const fixedStyleMap: Record<string, CompiledStyle | undefined> = fixedStyles;
const breakpointStyleMap: Record<string, CompiledStyle | undefined> = breakpointStyles;

function setVar(acc: LayoutStyle, name: string, value: string) {
  acc.style ??= {};
  acc.style[name] = value;
}

function isResponsive(prop: unknown): prop is Partial<Record<ResponsiveKey, any>> {
  return typeof prop === 'object' && prop !== null;
}

export interface LayoutPropOptions<T> {
  /**
   * The static-class vocabulary for this prop's values (`FIXED` in
   * scripts/genLinariaTheme.ts). Values found there need no inline variable.
   */
  fixed?: string;
  /**
   * Opt out of inline values; the caller sets them itself.
   */
  noInline?: boolean;
  /**
   * Maps a prop value to its CSS value. Returning undefined omits it.
   */
  resolve?: (value: T) => string | number | undefined;
}

function addBase<T>(
  acc: LayoutStyle,
  property: LayoutProperty,
  value: T,
  {fixed, noInline, resolve}: LayoutPropOptions<T>,
  allowInline: boolean
): boolean {
  if (acc.inline && allowInline && !noInline) {
    const resolved = resolve ? resolve(value) : value;
    if (resolved !== undefined) {
      setVar(acc, property, String(resolved));
    }
  }

  if (fixed !== undefined) {
    const fixedStyle = fixedStyleMap[`${fixed}:${String(value)}`];
    if (fixedStyle) {
      acc.classNames.push(fixedStyle);
      return true;
    }
  }

  const resolved = resolve ? resolve(value) : value;
  if (resolved === undefined) {
    return false;
  }
  acc.classNames.push(baseStyles[property]);
  setVar(acc, layoutVarName(property), String(resolved));
  return true;
}

/**
 * Adds the styles for one (possibly responsive) prop, with the semantics of
 * `rc()`: the first defined breakpoint applies unconditionally and every later
 * one from its min-width up.
 */
export function addLayoutProp<T>(
  acc: LayoutStyle,
  property: LayoutProperty,
  value: Responsive<T> | undefined,
  options: LayoutPropOptions<T> = {}
): void {
  if (value === undefined) {
    return;
  }

  if (!isResponsive(value)) {
    addBase(acc, property, value, options, true);
    return;
  }

  let first = true;
  for (const key of RESPONSIVE_KEYS) {
    const v = (value as Partial<Record<ResponsiveKey, T>>)[key];
    if (v === undefined) {
      continue;
    }

    if (first) {
      // Never inline: the breakpoint classes below must be able to override it.
      first = !addBase(acc, property, v, options, false);
      continue;
    }

    const resolved = options.resolve ? options.resolve(v) : v;
    if (resolved === undefined) {
      continue;
    }
    const breakpointStyle = breakpointStyleMap[`${property}@${key}`];
    if (breakpointStyle) {
      acc.classNames.push(breakpointStyle);
      setVar(acc, layoutVarName(property, key), String(resolved));
    }
  }
}

/**
 * Adds compiled Linaria class names to the element.
 */
export function addStyles(
  acc: LayoutStyle,
  ...styles: Array<CompiledStyle | false | null | undefined>
): void {
  for (const style of styles) {
    if (style) {
      acc.classNames.push(style);
    }
  }
}

/**
 * Merges the computed layout styles with the `className` and `style` passed to
 * the component. Caller classes follow the normal CSS cascade; Emotion
 * wrappers use a later stylesheet. Caller inline styles take precedence.
 */
export function finishLayoutStyle(
  acc: LayoutStyle,
  className: string | undefined,
  style: CSSProperties | undefined
): {className: string; style: CSSProperties | undefined} {
  if (className) {
    acc.classNames.push(className);
  }
  return {
    className: acc.classNames.join(' '),
    style: acc.style ? (style ? {...acc.style, ...style} : acc.style) : style,
  };
}
