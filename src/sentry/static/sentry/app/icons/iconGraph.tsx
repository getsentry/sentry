import React from 'react';

import SvgIcon from './svgIcon';
import {IconGraphLine} from './iconGraphLine';
import {IconGraphCircle} from './iconGraphCircle';
import {IconGraphBar} from './iconGraphBar';

type Props = React.ComponentProps<typeof SvgIcon> & {
  type?: 'line' | 'circle' | 'bar';
};

const IconGraph = React.forwardRef(function IconGraph(
  {type = 'line', ...props}: Props,
  ref: React.Ref<SVGSVGElement>
) {
  switch (type) {
    case 'circle':
      return <IconGraphCircle {...props} ref={ref} />;
    case 'bar':
      return <IconGraphBar {...props} ref={ref} />;
    default:
      return <IconGraphLine {...props} ref={ref} />;
  }
});

IconGraph.displayName = 'IconGraph';

export {IconGraph};
