import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGeneric = React.forwardRef(function IconGeneric(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,0a8,8,0,1,0,8,8A8,8,0,0,0,8,0ZM7.5,13.3h0l-.13-.05-3.6-1.82A1.41,1.41,0,0,1,3,10.16V5.84a2,2,0,0,1,0-.25L7.5,7.85Zm-4-8.57a1.14,1.14,0,0,1,.23-.15L7.38,2.76a1.38,1.38,0,0,1,1.25,0l3.6,1.82a.91.91,0,0,1,.24.16L8,7ZM13,10.17a1.42,1.42,0,0,1-.77,1.26l-3.6,1.82-.13.05V7.85L13,5.6a1.94,1.94,0,0,1,0,.24Z" />
    </SvgIcon>
  );
});

IconGeneric.displayName = 'IconGeneric';

export {IconGeneric};
