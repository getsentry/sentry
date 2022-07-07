import * as Icons from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';

export type IconProps = SVGIconProps & {
  direction?: 'left' | 'right' | 'up' | 'down';
  isCircled?: boolean;
  isSolid?: boolean;
  type?: 'line' | 'circle' | 'bar' | 'area';
};

const IconSample = ({name, ...props}: IconProps & {name: string}) => {
  const Icon = Icons[`Icon${name}`];

  if (!Icon) {
    return null;
  }

  return <Icon {...props} />;
};

export default IconSample;
