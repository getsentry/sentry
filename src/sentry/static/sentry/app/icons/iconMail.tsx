import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconMail = React.forwardRef(function IconMail(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.25,14.09H.75A.76.76,0,0,1,0,13.34V2.66a.76.76,0,0,1,.75-.75h14.5a.76.76,0,0,1,.75.75V13.34A.76.76,0,0,1,15.25,14.09ZM1.5,12.59h13V3.41H1.5Z" />
      <path d="M8,9.92a.78.78,0,0,1-.5-.19L.25,3.22a.75.75,0,1,1,1-1.12L8,8.16,14.75,2.1a.75.75,0,1,1,1,1.12L8.5,9.73A.78.78,0,0,1,8,9.92Z" />
      <rect
        x="-0.27"
        y="9.92"
        width="7.99"
        height="1.5"
        transform="translate(-6.17 5.21) rotate(-41.89)"
      />
      <rect
        x="11.52"
        y="6.67"
        width="1.5"
        height="7.99"
        transform="translate(-3.86 12.68) rotate(-48.09)"
      />
    </SvgIcon>
  );
});

IconMail.displayName = 'IconMail';

export {IconMail};
