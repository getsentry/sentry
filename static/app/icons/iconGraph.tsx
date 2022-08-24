import {forwardRef} from 'react';

import {IconGraphArea} from './iconGraphArea';
import {IconGraphBar} from './iconGraphBar';
import {IconGraphCircle} from './iconGraphCircle';
import {IconGraphLine} from './iconGraphLine';
import {SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  type?: 'line' | 'circle' | 'bar' | 'area';
}

const IconGraph = forwardRef<SVGSVGElement, Props>(({type = 'line', ...props}, ref) => {
  switch (type) {
    case 'circle':
      return <IconGraphCircle {...props} ref={ref} />;
    case 'bar':
      return <IconGraphBar {...props} ref={ref} />;
    case 'area':
      return <IconGraphArea {...props} ref={ref} />;
    default:
      return <IconGraphLine {...props} ref={ref} />;
  }
});

IconGraph.displayName = 'IconGraph';

export {IconGraph};
