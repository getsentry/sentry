import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import type {Aliases, Color, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: Color | keyof Aliases | 'currentColor';
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  size?: IconSize;
}

interface IconProps extends SVGIconProps {
  /**
   * Determines if the icon coloring is done using stroke or fill
   */
  kind?: 'stroke' | 'path';
}

export const SvgIcon = forwardRef<SVGSVGElement, IconProps>((props, ref) => {
  const {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    legacySize,
    ...rest
  } = useIconDefaults(props);

  const theme = useTheme();
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const color = theme[providedColor] ?? providedColor;
  const size = legacySize ?? theme.iconSizes[providedSize];

  // Stroke based icons are only available in Chonk
  if (props.kind === 'stroke' && theme.isChonk) {
    return (
      <svg
        role="img"
        viewBox={'1.25 1.25 13.5 13.5'}
        height={size}
        width={size}
        ref={ref}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25px"
        {...rest}
      />
    );
  }

  return (
    <svg
      // The icons only ever contain a single graphic, so we can use the img role
      role="img"
      viewBox={viewBox}
      {...rest}
      fill={color}
      height={size}
      width={size}
      ref={ref}
    />
  );
});
