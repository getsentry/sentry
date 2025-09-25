import {useTheme} from '@emotion/react';

import type {ColorOrAlias, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: ColorOrAlias | 'currentColor';
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  ref?: React.Ref<SVGSVGElement>;
  size?: IconSize;
}

interface IconProps extends SVGIconProps {
  /**
   * Determines if the icon coloring is done using stroke or fill
   */
  kind?: 'stroke' | 'path';
}

export function SvgIcon(props: IconProps) {
  const {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    legacySize,
    ...rest
  } = useIconDefaults(props);

  const theme = useTheme();
  const color = useResolvedIconColor(providedColor);
  const size = legacySize ?? theme.iconSizes[providedSize];

  // Stroke based icons are only available in Chonk
  if (props.kind === 'stroke' && theme.isChonk) {
    return (
      <svg
        role="img"
        viewBox={'1 1 14 14'}
        height={size}
        width={size}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1px"
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
    />
  );
}

export function useResolvedIconColor(
  color: ColorOrAlias | 'currentColor' | undefined
): string {
  const theme = useTheme();
  const {color: providedColor = 'currentColor'} = useIconDefaults({color});
  if (providedColor === 'currentColor') {
    return 'currentColor';
  }

  // Chonk changes the color of the icon to gray300 to differ. We will remap
  // the color to subText for the time being and remove this when the old theme
  // aliases are removed.
  let normalizedColor = providedColor;
  if (theme.isChonk && providedColor === 'gray300') {
    normalizedColor = 'subText';
  }
  const resolvedColor = theme[normalizedColor];
  if (typeof resolvedColor === 'string') {
    return resolvedColor;
  }
  return normalizedColor;
}
