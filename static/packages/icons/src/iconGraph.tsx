import {IconGraphArea} from './iconGraphArea';
import {IconGraphBar} from './iconGraphBar';
import {IconGraphCircle} from './iconGraphCircle';
import {IconGraphHeatmap} from './iconGraphHeatmap';
import {IconGraphLine} from './iconGraphLine';
import {IconGraphScatter} from './iconGraphScatter';
import type {SVGIconProps} from './svgIcon';

export interface IconGraphProps extends SVGIconProps {
  type?: 'line' | 'circle' | 'bar' | 'area' | 'scatter' | 'heatmap';
}

export function IconGraph({type = 'line', ...props}: IconGraphProps) {
  switch (type) {
    case 'circle':
      return <IconGraphCircle {...props} />;
    case 'bar':
      return <IconGraphBar {...props} />;
    case 'area':
      return <IconGraphArea {...props} />;
    case 'scatter':
      return <IconGraphScatter {...props} />;
    case 'heatmap':
      return <IconGraphHeatmap {...props} />;
    default:
      return <IconGraphLine {...props} />;
  }
}
