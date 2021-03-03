import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconZepel = React.forwardRef(function IconZepel(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M10.59 11.32H5.12v-1.18l3.27-4.09h-3V4.59h5.2v1.2L7.3 9.86h3.29v1.46z" />
      <circle cx="4.3" cy="1.1" r="1.1" />
      <circle cx="11.43" cy="14.9" r="1.1" />
      <path d="M9.82 15.42H1.06a.86.86 0 01-.85-.87V1.17A.86.86 0 011.06.3h1.52L2.5.61a1.34 1.34 0 000 .35 1.24 1.24 0 000 .27l.06.3H1.47v12.66h8.18v.28a.62.62 0 000 .13 1.57 1.57 0 00.08.49zM14.94 15.42H13l.12-.33a1.36 1.36 0 00.08-.49V14.19h1.34V1.53H6l.07-.3a2.45 2.45 0 000-.27 1.34 1.34 0 000-.35L6 .3h8.93a.86.86 0 01.85.87v13.38a.86.86 0 01-.84.87z" />
    </SvgIcon>
  );
});

IconZepel.displayName = 'IconZepel';

export {IconZepel};
