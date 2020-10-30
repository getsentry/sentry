/* HACK(BYK): This file is a slightly modified backport of
 *
 * !!! DELETE ME WHEN UPGRADING TO EMOTION@11 !!!
 *
 * https://github.com/emotion-js/emotion/pull/1501 and
 * https://github.com/emotion-js/emotion/pull/1664 to
 * fix our TypeScript compile times and memory usage as
 * emotion@10 is known to generate too many new types due
 * to improper use of generics.
 *
 * This is especially pronounced with TS 3.7+
 * See https://github.com/microsoft/TypeScript/issues/24435
 * See https://github.com/microsoft/TypeScript/issues/34920
 */

import styled from '@original-emotion/styled';
import * as React from 'react';
// TODO(BYK): Figure out why ESLint cannot resolve this
//            probably need to include `.d.ts` extension
//            in some resolver config.
// eslint-disable-next-line import/no-unresolved
import * as CSS from 'csstype';

import {Theme} from './utils/theme';

/**
 * @desc Utility type for getting props type of React component.
 */
export type PropsOf<
  C extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>
> = JSX.LibraryManagedAttributes<C, React.ComponentProps<C>>;

export interface SerializedStyles {
  name: string;
  styles: string;
  map?: string;
  next?: SerializedStyles;
}

export interface StyledOptions {
  label?: string;
  shouldForwardProp?(propName: string): boolean;
  target?: string;
}

export interface CSSObject
  extends CSSPropertiesWithMultiValues,
    CSSPseudosForCSSObject,
    CSSOthersObjectForCSSObject {}

export interface ComponentSelector {
  __emotion_styles: any;
}

export type Keyframes = {
  name: string;
  styles: string;
  anim: number;
  toString: () => string;
} & string;

export type CSSProperties = CSS.PropertiesFallback<number | string>;
export type CSSPropertiesWithMultiValues = {
  [K in keyof CSSProperties]: CSSProperties[K] | Array<Extract<CSSProperties[K], string>>;
};
/**
 * @desc Following type exists for autocompletion of key.
 */
export type CSSPseudos<MP> = {[K in CSS.Pseudos]?: ObjectInterpolation<MP>};
export interface CSSOthersObject<MP> {
  [propertiesName: string]: Interpolation<MP>;
}

export type CSSPseudosForCSSObject = {[K in CSS.Pseudos]?: CSSObject};

export interface ArrayCSSInterpolation extends Array<CSSInterpolation> {}

export type CSSInterpolation =
  | null
  | undefined
  | boolean
  | number
  | string
  | ComponentSelector
  | Keyframes
  | SerializedStyles
  | CSSObject
  | ArrayCSSInterpolation;

export interface CSSOthersObjectForCSSObject {
  [propertiesName: string]: CSSInterpolation;
}

export interface ArrayInterpolation<MP> extends Array<Interpolation<MP>> {}
export interface ObjectInterpolation<MP>
  extends CSSPropertiesWithMultiValues,
    CSSPseudos<MP>,
    CSSOthersObject<MP> {}

export interface FunctionInterpolation<MergedProps> {
  (mergedProps: MergedProps): Interpolation<MergedProps>;
}

export type Interpolation<MergedProps = undefined> =
  | null
  | undefined
  | boolean
  | number
  | string
  | ComponentSelector
  | Keyframes
  | SerializedStyles
  | ArrayInterpolation<MergedProps>
  | ObjectInterpolation<MergedProps>
  | FunctionInterpolation<MergedProps>;

/**
 * @typeparam ComponentProps  Props which will be included when withComponent is called
 * @typeparam SpecificComponentProps  Props which will *not* be included when withComponent is called
 */
export interface StyledComponent<
  ComponentProps extends {},
  SpecificComponentProps extends {} = {}
> extends React.FC<ComponentProps & SpecificComponentProps>,
    ComponentSelector {
  withComponent<C extends React.ComponentType<React.ComponentProps<C>>>(
    component: C
  ): StyledComponent<ComponentProps & PropsOf<C>>;
  withComponent<Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag
  ): StyledComponent<ComponentProps, JSX.IntrinsicElements[Tag]>;
}

/**
 * @typeparam ComponentProps  Props which will be included when withComponent is called
 * @typeparam SpecificComponentProps  Props which will *not* be included when withComponent is called
 * @typeparam StyleProps  Params passed to styles but not exposed as React props. These are normally library provided props
 */
export interface CreateStyledComponent<
  ComponentProps extends {},
  SpecificComponentProps extends {} = {},
  StyleProps extends {} = {}
> {
  /**
   * @typeparam AdditionalProps  Additional props to add to your styled component
   */
  <AdditionalProps extends {} = {}>(
    ...styles: Array<
      Interpolation<
        ComponentProps &
          SpecificComponentProps &
          StyleProps &
          AdditionalProps & {theme: Theme}
      >
    >
  ): StyledComponent<ComponentProps & AdditionalProps, SpecificComponentProps>;

  (
    template: TemplateStringsArray,
    ...styles: Array<Interpolation<ComponentProps & SpecificComponentProps & StyleProps>>
  ): StyledComponent<ComponentProps, SpecificComponentProps>;

  /**
   * @typeparam AdditionalProps  Additional props to add to your styled component
   */
  <AdditionalProps extends {}>(
    template: TemplateStringsArray,
    ...styles: Array<
      Interpolation<
        ComponentProps &
          SpecificComponentProps &
          StyleProps &
          AdditionalProps & {theme: Theme}
      >
    >
  ): StyledComponent<ComponentProps & AdditionalProps, SpecificComponentProps>;
}

/**
 * @desc
 * This function accepts a React component or tag ('div', 'a' etc).
 *
 * @example styled(MyComponent)({ width: 100 })
 * @example styled(MyComponent)(myComponentProps => ({ width: myComponentProps.width })
 * @example styled('div')({ width: 100 })
 * @example styled('div')<Props>(props => ({ width: props.width })
 */
export interface CreateStyled {
  // This `any` below, should be `React.ComponentProps` but https://github.com/getsentry/sentry/pull/15383 prevents it
  <C extends React.ComponentType<any>>(
    component: C,
    options?: StyledOptions
  ): CreateStyledComponent<PropsOf<C> & {theme?: Theme}, {}, {theme: Theme}>;

  <Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions
  ): CreateStyledComponent<{theme?: Theme}, JSX.IntrinsicElements[Tag], {theme: Theme}>;
}

export default styled as CreateStyled;
