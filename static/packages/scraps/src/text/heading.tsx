import type * as React from 'react';

import {type Responsive} from '@sentry/scraps/layout';
import {LayoutElement} from '@sentry/scraps/layout/container';
import {addLayoutProp, useLayoutStyle} from '@sentry/scraps/layout/yakLayout';
import type {HeadingSize, Theme} from '@sentry/scraps/theme';

import {getFontSize, getLineHeight} from './styles';
import {type BaseTextProps} from './text';
import {addTextStyles, textStyleProps} from './yakStyles';

type BaseHeadingProps = Omit<BaseTextProps, 'bold' | 'uppercase' | 'trim'>;

type ExclusiveHeadingEllipsisProps =
  | {ellipsis?: true; wrap?: never}
  | {ellipsis?: never; wrap?: BaseTextProps['wrap']};

export type HeadingProps = BaseHeadingProps & {
  /**
   * The HTML element to render the title as.
   * @required
   */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  ref?: React.Ref<HTMLHeadingElement | null> | undefined;
  /**
   * The size of the text.
   * @default md
   */
  size?: Responsive<HeadingSize>;
  /**
   * Deprecated in favor of the Text component API.
   * If you have an is an unsupported use-case, please contact design engineering for support.
   * @deprecated
   */
  style?: React.CSSProperties;
} & Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>,
    'style'
  > &
  ExclusiveHeadingEllipsisProps;

export type HeadingPropsWithRenderFunction = BaseHeadingProps &
  ExclusiveHeadingEllipsisProps & {
    children: (props: {
      className: string;
      style?: React.CSSProperties;
    }) => React.ReactNode | undefined;
    as?: never;
    ref?: never;
    size?: Responsive<HeadingSize>;
  } & Partial<
    Record<
      // HTMLAttributes extends from DOMAttributes which types children as React.ReactNode | undefined.
      // Therefore, we need to exclude it from the map, or the children will produce a never type.
      Exclude<
        keyof React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLHeadingElement>,
          HTMLHeadingElement
        >,
        'children'
      >,
      never
    >
  >;

export function Heading(props: HeadingProps | HeadingPropsWithRenderFunction) {
  const acc = useLayoutStyle(typeof props.children === 'function');
  addTextStyles(acc, props);
  const inherit = props.variant === 'inherit';
  addLayoutProp<HeadingSize | 'inherit'>(
    acc,
    'fontSize',
    inherit && props.size === undefined
      ? 'inherit'
      : (props.size ?? (props.as ? getDefaultHeadingFontSize(props.as) : undefined)),
    (v, theme) => (v === 'inherit' ? v : getFontSize(v, theme))
  );
  addLayoutProp<keyof Theme['font']['lineHeight'] | 'inherit'>(
    acc,
    'lineHeight',
    inherit && props.density === undefined ? 'inherit' : props.density,
    (v, theme) => (v === 'inherit' ? v : getLineHeight(v, theme))
  );
  addLayoutProp(
    acc,
    'fontWeight',
    inherit ? 'inherit' : acc.theme.font.weight[props.monospace ? 'mono' : 'sans'].medium
  );
  return (
    <LayoutElement
      elementProps={props}
      layoutStyle={acc}
      omitProps={textStyleProps}
      defaultElement="h1"
    />
  );
}

function getDefaultHeadingFontSize(as: HeadingProps['as']): HeadingSize {
  switch (as) {
    case 'h1':
      return '2xl';
    case 'h2':
      return 'xl';
    case 'h3':
      return 'lg';
    case 'h4':
      return 'md';
    case 'h5':
      return 'sm';
    case 'h6':
      return 'xs';
    default:
      return '2xl';
  }
}
