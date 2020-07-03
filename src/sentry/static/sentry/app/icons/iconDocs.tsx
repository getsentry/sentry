import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconDocs = React.forwardRef(function IconDocs(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,15.27a.76.76,0,0,1-.75-.75V2.06a.75.75,0,0,1,1.5,0V14.52A.76.76,0,0,1,8,15.27Z" />
      <path d="M5.74,5.38H2.93a.75.75,0,0,1,0-1.5H5.74a.75.75,0,0,1,0,1.5Z" />
      <path d="M5.74,7.89H2.93a.75.75,0,0,1,0-1.5H5.74a.75.75,0,0,1,0,1.5Z" />
      <path d="M13.07,5.38H10.26a.75.75,0,0,1,0-1.5h2.81a.75.75,0,0,1,0,1.5Z" />
      <path d="M13.07,7.89H10.26a.75.75,0,0,1,0-1.5h2.81a.75.75,0,0,1,0,1.5Z" />
      <path d="M15.25,14.62h-.07a76.54,76.54,0,0,0-14.36,0,.67.67,0,0,1-.57-.19A.73.73,0,0,1,0,13.87V2.06a.76.76,0,0,1,.75-.75h14.5a.76.76,0,0,1,.75.75V13.87a.73.73,0,0,1-.25.55A.7.7,0,0,1,15.25,14.62ZM8,12.77c2.23,0,4.41.09,6.5.27V2.81H1.5V13C3.59,12.86,5.77,12.77,8,12.77Z" />
    </SvgIcon>
  );
});

IconDocs.displayName = 'IconDocs';

export {IconDocs};
