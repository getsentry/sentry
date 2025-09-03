import {IconGraphArea} from './iconGraphArea';
import {IconGraphBar} from './iconGraphBar';
import {IconGraphCircle} from './iconGraphCircle';
import {IconGraphLine} from './iconGraphLine';
import {IconGraphScatter} from './iconGraphScatter';
import type {SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  type?: 'line' | 'circle' | 'bar' | 'area' | 'scatter';
}

export function IconGraph({type = 'line', ...props}: Props) {
  switch (type) {
    case 'circle':
      return <IconGraphCircle {...props} />;
    case 'bar':
      return <IconGraphBar {...props} />;
    case 'area':
      return <IconGraphArea {...props} />;
    case 'scatter':
      return <IconGraphScatter {...props} />;
    default:
      return <IconGraphLine {...props} />;
  }
}
