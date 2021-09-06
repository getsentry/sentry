import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconCode = React.forwardRef(function IconChat(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M3.82 12.3a.79.79 0 0 1-.53-.22l-3-3.05a.74.74 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 1.01L1.84 8.5l2.51 2.52a.75.75 0 0 1-.53 1.28ZM12.18 12.3a.75.75 0 0 1-.53-1.28l2.51-2.52-2.51-2.52a.75.75 0 1 1 1.06-1.06l3 3.05a.741.741 0 0 1 0 1.06l-3 3.05a.79.79 0 0 1-.53.22ZM5.69 14.25A.75.75 0 0 1 5 13.19l4.62-10a.75.75 0 0 1 1-.36.74.74 0 0 1 .36 1l-4.62 10a.76.76 0 0 1-.67.42Z" />
    </SvgIcon>
  );
});

IconCode.displayName = 'IconCode';

export {IconCode};
