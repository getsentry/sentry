import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconDownload = React.forwardRef(function IconDownload(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.24,16H.76A.76.76,0,0,1,0,15.27V9.74A.76.76,0,0,1,.76,9a.76.76,0,0,1,.75.75v4.78h13V9.74a.75.75,0,0,1,1.5,0v5.53A.76.76,0,0,1,15.24,16Z" />
      <path d="M8,12.08a.79.79,0,0,1-.53-.22L3.32,7.71a.77.77,0,0,1,0-1.07.75.75,0,0,1,1.06,0L8,10.27l3.62-3.63a.75.75,0,0,1,1.06,0,.77.77,0,0,1,0,1.07L8.53,11.86A.79.79,0,0,1,8,12.08Z" />
      <path d="M8,12.08a.76.76,0,0,1-.75-.75V1a.75.75,0,0,1,1.5,0V11.33A.76.76,0,0,1,8,12.08Z" />
    </SvgIcon>
  );
});

IconDownload.displayName = 'IconDownload';

export {IconDownload};
