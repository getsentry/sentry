import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconUpload = React.forwardRef(function IconUpload(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.24,16H.76A.76.76,0,0,1,0,15.27V9.74A.76.76,0,0,1,.76,9a.76.76,0,0,1,.75.75v4.78h13V9.74a.75.75,0,0,1,1.5,0v5.53A.76.76,0,0,1,15.24,16Z" />
      <path d="M12.15,5.86a.74.74,0,0,1-.53-.22L8,2,4.38,5.64A.75.75,0,0,1,3.32,4.58L7.47.43a.75.75,0,0,1,1.06,0l4.15,4.15a.75.75,0,0,1,0,1.06A.73.73,0,0,1,12.15,5.86Z" />
      <path d="M8,12.08a.76.76,0,0,1-.75-.75V1a.75.75,0,0,1,1.5,0V11.33A.76.76,0,0,1,8,12.08Z" />
    </SvgIcon>
  );
});

IconUpload.displayName = 'IconUpload';

export {IconUpload};
