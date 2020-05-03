import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconEllipsis = (props: Props) => (
  <SvgIcon {...props}>
    <circle cx="8" cy="8" r="1.31" />
    <circle cx="1.31" cy="8" r="1.31" />
    <circle cx="14.69" cy="8" r="1.31" />
  </SvgIcon>
);

export default IconEllipsis;
