export interface IconProps extends React.SVGAttributes<SVGElement> {
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  direction?: 'up' | 'right' | 'down' | 'left';
  solid?: boolean;
  circle?: boolean;
  type?: 'bar' | 'circle' | 'line';
}
