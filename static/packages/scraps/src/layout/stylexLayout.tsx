import type {CSSProperties} from 'react';
import * as stylex from '@stylexjs/stylex';

import {
  baseStyles,
  breakpointStyles,
  breakpointVarSuffix,
  fixedStyles,
  type LayoutProperty,
} from './generatedStyles';
import type {Responsive, ResponsiveKey} from './styles';

/**
 * The StyleX counterpart of `rc()`: turns layout props into class names (and,
 * for values without a static class, inline custom properties) instead of
 * serializing CSS at runtime.
 *
 * Each CSS property must be added at most once per element. Unlike Emotion,
 * two classes for the same property are ordered by the stylesheet, not by the
 * order they were added in.
 */
export interface LayoutStyle {
  classNames: string[];
  /**
   * Set plain (non-responsive) values as inline styles instead of classes.
   * Used for the render-prop form, where the styles land on the caller's
   * element: with Emotion, layout props were composed after that element's
   * own (often Emotion) styles and won; classes from an earlier stylesheet
   * would lose to them.
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

/** Must match `layoutVarName` in scripts/genStylexTheme.ts. */
function layoutVarName(property: LayoutProperty, key?: ResponsiveKey): string {
  return key ? `--sx-${property}-${breakpointVarSuffix[key]}` : `--sx-${property}`;
}

type CompiledStyle = Record<PropertyKey, unknown>;

const classNameCache = new WeakMap<CompiledStyle, string>();

/**
 * The class name of a compiled, static StyleX style. Typed loosely because the
 * generated styles hold values (`var(--sx-…)`) outside StyleX's typed CSS.
 */
function classNameOf(style: CompiledStyle): string {
  let className = classNameCache.get(style);
  if (className === undefined) {
    className = stylex.props(style as stylex.StyleXStyles).className ?? '';
    classNameCache.set(style, className);
  }
  return className;
}

const fixedStyleMap: Record<string, CompiledStyle | undefined> = fixedStyles;
const breakpointStyleMap: Record<string, CompiledStyle | undefined> = breakpointStyles;

function setVar(acc: LayoutStyle, name: string, value: string) {
  acc.style ??= {};
  acc.style[name] = value;
}

function isResponsive(prop: unknown): prop is Partial<Record<ResponsiveKey, any>> {
  return typeof prop === 'object' && prop !== null;
}

interface LayoutPropOptions<T> {
  /**
   * The static-class vocabulary for this prop's values (`FIXED` in
   * scripts/genStylexTheme.ts). Values found there need no inline variable.
   */
  fixed?: string;
  /**
   * Maps a prop value to its CSS value. Returning undefined omits it.
   */
  resolve?: (value: T) => string | number | undefined;
}

function addBase<T>(
  acc: LayoutStyle,
  property: LayoutProperty,
  value: T,
  {fixed, resolve}: LayoutPropOptions<T>,
  allowInline: boolean
): boolean {
  if (acc.inline && allowInline) {
    const resolved = resolve ? resolve(value) : value;
    if (resolved === undefined) {
      return false;
    }
    setVar(acc, property, String(resolved));
    return true;
  }

  if (fixed !== undefined) {
    const fixedStyle = fixedStyleMap[`${fixed}:${String(value)}`];
    if (fixedStyle) {
      acc.classNames.push(classNameOf(fixedStyle));
      return true;
    }
  }

  const resolved = resolve ? resolve(value) : value;
  if (resolved === undefined) {
    return false;
  }
  acc.classNames.push(classNameOf(baseStyles[property]));
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
      acc.classNames.push(classNameOf(breakpointStyle));
      setVar(acc, layoutVarName(property, key), String(resolved));
    }
  }
}

/**
 * Adds static StyleX styles (from `stylex.create`) to the element.
 */
export function addStyles(
  acc: LayoutStyle,
  ...styles: Array<CompiledStyle | false | null | undefined>
): void {
  for (const style of styles) {
    if (style) {
      acc.classNames.push(classNameOf(style));
    }
  }
}

/**
 * Merges the computed layout styles with the `className` and `style` passed to
 * the component. Those come last, so Emotion wrappers (`styled(Flex)`) and
 * inline styles still win.
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
