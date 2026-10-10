import {LayoutElement} from '@sentry/scraps/layout/container';
import {addStyles, createLayoutStyle} from '@sentry/scraps/layout/linariaLayout';
import type {Responsive} from '@sentry/scraps/layout/styles';
import type {HeadingSize} from '@sentry/scraps/theme';

import {
  addCommonTextStyles,
  addDensity,
  addFontSize,
  getFontWeightStyle,
  inheritStyles,
  TEXT_STYLE_PROPS,
} from './linariaStyles';
import {type BaseTextProps} from './text';

type BaseHeadingProps = Omit<BaseTextProps, 'bold' | 'uppercase'>;

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

function HeadingComponent(props: HeadingProps | HeadingPropsWithRenderFunction) {
  const acc = createLayoutStyle(typeof props.children === 'function');
  const inherit = props.variant === 'inherit';

  if (inherit && props.size === undefined) {
    addStyles(acc, inheritStyles.fontSize);
  } else {
    addFontSize(
      acc,
      props.size ?? (props.as ? getDefaultHeadingFontSize(props.as) : undefined)
    );
  }
  if (inherit && props.density === undefined) {
    addStyles(acc, inheritStyles.lineHeight);
  } else {
    addDensity(acc, props.density);
  }
  addCommonTextStyles(acc, props, {fullWidthEllipsis: false});
  addStyles(
    acc,
    inherit ? inheritStyles.fontWeight : getFontWeightStyle(props.monospace, 'medium')
  );

  // `as` is required on the element form; the render-prop form never renders one.
  return (
    <LayoutElement
      elementProps={props}
      layoutStyle={acc}
      omitProps={TEXT_STYLE_PROPS}
      defaultElement="h1"
    />
  );
}

export const Heading = HeadingComponent as (
  props: HeadingProps | HeadingPropsWithRenderFunction
) => React.ReactElement;

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
