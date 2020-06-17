import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconEdit = React.forwardRef(function IconEdit(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M1.36,15.91a1.34,1.34,0,0,1-.94-.38,1.32,1.32,0,0,1-.35-1.28L1.39,9a.94.94,0,0,1,.2-.35l8.06-8A1.71,1.71,0,0,1,12,.56l3.42,3.25A1.68,1.68,0,0,1,16,5a1.64,1.64,0,0,1-.48,1.2l-8.06,8a.79.79,0,0,1-.34.2L1.71,15.87A1.39,1.39,0,0,1,1.36,15.91Zm.16-1.3ZM2.8,9.53,1.59,14.35,6.51,13l7.91-7.89A.14.14,0,0,0,14.47,5a.17.17,0,0,0-.05-.12L11,1.64a.23.23,0,0,0-.3,0h0Zm7.38-8.41h0Z" />
      <rect
        x="9.56"
        y="2.34"
        width="1.5"
        height="6.6"
        transform="translate(-0.91 9.12) rotate(-45.91)"
      />
      <rect
        x="3.76"
        y="8.12"
        width="1.5"
        height="6.6"
        transform="translate(-6.87 6.8) rotate(-46.34)"
      />
    </SvgIcon>
  );
});

IconEdit.displayName = 'IconEdit';

export {IconEdit};
