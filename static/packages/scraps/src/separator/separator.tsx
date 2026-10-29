import type * as React from 'react';

import {LayoutElement} from '@sentry/scraps/layout/container';
import type {ContainerProps} from '@sentry/scraps/layout/container';
import {getBorder, getMargin, getSpacing} from '@sentry/scraps/layout/styles';
import {addLayoutProp, useLayoutStyle} from '@sentry/scraps/layout/yakLayout';

export type SeparatorProps = Pick<ContainerProps, 'border' | 'margin' | 'padding'> & {
  orientation: 'horizontal' | 'vertical';
  children?: never;
} & Omit<React.HTMLAttributes<HTMLHRElement>, 'aria-orientation'>;

const omitted = new Set(['orientation', 'border', 'padding', 'margin']);
export function Separator({orientation, ...props}: SeparatorProps) {
  const acc = useLayoutStyle();
  acc.classNames.push('yk-separator');
  addLayoutProp(acc, 'width', orientation === 'horizontal' ? 'auto' : '1px');
  addLayoutProp(acc, 'height', orientation === 'horizontal' ? '1px' : 'auto');
  addLayoutProp(acc, 'padding', props.padding, (v, theme) =>
    getSpacing(v, undefined, theme)
  );
  addLayoutProp(acc, 'margin', props.margin ?? '0', (v, theme) =>
    getMargin(v, undefined, theme)
  );
  addLayoutProp(acc, 'flexShrink', 0);
  addLayoutProp(acc, 'alignSelf', 'stretch');
  addLayoutProp(acc, 'border', 'none');
  addLayoutProp(acc, 'separatorBorder', props.border ?? 'primary', (v, theme) =>
    getBorder(v, undefined, theme)
  );
  return (
    <LayoutElement
      elementProps={{...props, 'aria-orientation': orientation}}
      layoutStyle={acc}
      omitProps={omitted}
      defaultElement="hr"
    />
  );
}
