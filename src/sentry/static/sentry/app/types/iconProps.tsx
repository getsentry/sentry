export type IconProps = React.SVGAttributes<SVGElement> & {
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  direction?: 'up' | 'right' | 'down' | 'left';
  solid?: boolean;
  circle?: boolean;
};
