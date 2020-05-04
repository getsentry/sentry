import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon> & {
  isCircle?: boolean;
};

const IconAdd = ({isCircle = false, ...props}: Props) => (
  <SvgIcon {...props}>
    {isCircle ? (
      <React.Fragment>
        <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
        <path d="M8,12a.76.76,0,0,1-.75-.75V4.72a.75.75,0,0,1,1.5,0v6.56A.76.76,0,0,1,8,12Z" />
        <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
      </React.Fragment>
    ) : (
      <React.Fragment>
        <path d="M15.19,8.75H.81a.75.75,0,1,1,0-1.5H15.19a.75.75,0,0,1,0,1.5Z" />
        <path d="M8,15.94a.76.76,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.76.76,0,0,1,8,15.94Z" />
      </React.Fragment>
    )}
  </SvgIcon>
);

export default IconAdd;
