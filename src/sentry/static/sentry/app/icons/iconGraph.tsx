import React from 'react';

import SvgIcon from './svgIcon';
import IconGraphLine from './iconGraphLine';
import IconGraphCircle from './iconGraphCircle';
import IconGraphBar from './iconGraphBar';

type Props = React.ComponentProps<typeof SvgIcon> & {
  type?: 'line' | 'circle' | 'bar';
};

const IconGraph = ({type = 'line', ...props}: Props) => {
  switch (type) {
    case 'circle':
      return <IconGraphCircle {...props} />;
    case 'bar':
      return <IconGraphBar {...props} />;
    default:
      return <IconGraphLine {...props} />;
  }
};

export default IconGraph;
