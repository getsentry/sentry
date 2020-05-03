import React from 'react';
import PropTypes from 'prop-types';

import theme, {IconSize, Color} from 'app/utils/theme';

type Props = Omit<React.SVGAttributes<SVGElement>, 'viewBox'> & {
  // TODO (Priscila): make color prop theme color only
  color?: Color | string;
  // TODO (Priscila): make size prop theme icon size only
  size?: IconSize | string;
  className?: string;
};

const SvgIcon = React.forwardRef<SVGSVGElement, Props>(function SvgIcon(
  {color: providedColor = 'currentColor', size: providedSize = 'sm', ...props},
  ref
) {
  const color = theme[providedColor] ?? providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg
      {...props}
      viewBox="0 0 16 16"
      fill={color}
      height={size}
      width={size}
      ref={ref}
    />
  );
});

SvgIcon.propTypes = {
  color: PropTypes.string,
  size: PropTypes.string,
};

export default SvgIcon;
