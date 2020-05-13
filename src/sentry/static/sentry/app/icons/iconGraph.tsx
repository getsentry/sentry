import React from 'react';

import SvgIcon from './svgIcon';
import {IconGraphLine} from './iconGraphLine';
import {IconGraphCircle} from './iconGraphCircle';
import {IconGraphBar} from './iconGraphBar';

type Props = React.ComponentProps<typeof SvgIcon> & {
  type?: 'line' | 'circle' | 'bar';
};

const IconGraph = React.forwardRef<SVGSVGElement, Props>(
  ({type = 'line', ...props}: Props, ref) => {
    switch (type) {
      case 'circle':
        return <IconGraphCircle {...props} ref={ref} />;
      case 'bar':
        return <IconGraphBar {...props} ref={ref} />;
      default:
        return <IconGraphLine {...props} ref={ref} />;
    }
  }
);

export {IconGraph};
