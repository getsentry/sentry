import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconMoon = React.forwardRef(function IconMoon(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M7.9 15.7C3.5 15.7 0 12.2 0 7.8C0 7.6 0 7.3 0 7.1C0 6.9 0.1 6.7 0.3 6.5C0.6 6.3 0.9 6.3 1.2 6.5C1.3 6.6 1.3 6.6 1.4 6.7C2.1 7.7 3.3 8.3 4.5 8.3C6.6 8.3 8.3 6.6 8.3 4.5C8.3 3.3 7.7 2.1 6.7 1.4C6.4 1.2 6.3 0.9 6.4 0.6C6.5 0.3 6.7 0.1 7 0C7.3 0 7.5 0 7.8 0C12.2 0 15.7 3.5 15.7 7.9C15.7 12.3 12.3 15.7 7.9 15.7ZM1.6 8.8C2.1 11.8 4.8 14.1 7.9 14.1C11.4 14.1 14.3 11.2 14.3 7.7C14.3 4.5 12 1.9 8.9 1.4C9.5 2.3 9.8 3.3 9.8 4.3C9.8 7.2 7.4 9.6 4.5 9.6C3.5 9.7 2.5 9.4 1.6 8.8Z" />
    </SvgIcon>
  );
});

IconMoon.displayName = 'IconMoon';

export {IconMoon};
