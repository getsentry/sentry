import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconStack = React.forwardRef(function IconStack(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,9.87a.76.76,0,0,1-.38-.11L.39,5.59A.74.74,0,0,1,0,4.94a.77.77,0,0,1,.37-.65L7.62.12a.79.79,0,0,1,.76,0l7.23,4.17a.77.77,0,0,1,.37.65.74.74,0,0,1-.37.65L8.38,9.76A.76.76,0,0,1,8,9.87ZM2.27,4.94,8,8.25l5.73-3.31L8,1.64Z" />
      <path d="M8,12.93a.75.75,0,0,1-.38-.1L.39,8.66a.76.76,0,0,1-.27-1,.75.75,0,0,1,1-.27l6.86,4,6.86-3.95a.75.75,0,0,1,1,.27.76.76,0,0,1-.27,1L8.38,12.83A.75.75,0,0,1,8,12.93Z" />
      <path d="M8,16a.76.76,0,0,1-.38-.11L.39,11.72a.75.75,0,0,1,.75-1.3l6.86,4,6.86-4a.75.75,0,0,1,1,.28.75.75,0,0,1-.27,1L8.38,15.89A.76.76,0,0,1,8,16Z" />
    </SvgIcon>
  );
});

IconStack.displayName = 'IconStack';

export {IconStack};
