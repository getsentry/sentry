import {IconSizes} from 'app/utils/theme';

export type IconProps = React.SVGAttributes<SVGElement> & {
  color?: string;
  size?: IconSizes | string;
  direction?: 'up' | 'right' | 'down' | 'left';
  solid?: boolean;
  circle?: boolean;
};
