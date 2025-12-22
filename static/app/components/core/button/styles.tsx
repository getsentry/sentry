// eslint-disable-next-line boundaries/element-types
import {type SVGIconProps} from 'sentry/icons/svgIcon';

import type {DO_NOT_USE_CommonButtonProps as CommonButtonProps} from './types';

export const DO_NOT_USE_BUTTON_ICON_SIZES: Record<
  NonNullable<CommonButtonProps['size']>,
  SVGIconProps['size']
> = {
  zero: undefined,
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
};
