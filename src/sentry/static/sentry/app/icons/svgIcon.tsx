import * as React from 'react';
import PropTypes from 'prop-types';

import theme, {IconSize, Color} from 'app/utils/theme';

type Props = React.SVGAttributes<SVGElement> & {
  color?: Color;
  // TODO (Priscila): make size prop theme icon size only
  size?: IconSize | string;
  className?: string;
};

const SvgIcon = React.forwardRef<SVGSVGElement, Props>(function SvgIcon(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    ...props
  },
  ref
) {
  const color = theme[providedColor] ?? providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg {...props} viewBox={viewBox} fill={color} height={size} width={size} ref={ref} />
  );
});

SvgIcon.propTypes = {
  // @ts-ignore
  color: PropTypes.string,
  size: PropTypes.string,
  viewBox: PropTypes.string,
};

export default SvgIcon;
