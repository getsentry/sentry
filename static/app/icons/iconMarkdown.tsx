import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconMarkdown = React.forwardRef(function IconMarkdown(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12.21,12.31l1.26-1.26a.75.75,0,0,1,1.06,1.06l-2.6,2.6a.75.75,0,0,1-.53.22.79.79,0,0,1-.53-.22l-2.6-2.6a.75.75,0,0,1,1.07-1.06l1.25,1.26V4.54L7.94,9.66a1.42,1.42,0,0,1-.29.4.57.57,0,0,1-.4.14H6.6a.6.6,0,0,1-.41-.14,1.65,1.65,0,0,1-.29-.4L3.25,4.54V12.6a.44.44,0,0,1-.13.32.47.47,0,0,1-.33.14h-.7a.45.45,0,0,1-.32-.14.44.44,0,0,1-.13-.32v-11a.44.44,0,0,1,.13-.33.44.44,0,0,1,.32-.13h.65a.63.63,0,0,1,.47.17,1.39,1.39,0,0,1,.28.37L6.92,8.35,10.36,1.7a1.21,1.21,0,0,1,.28-.37.61.61,0,0,1,.46-.17h.65a.42.42,0,0,1,.32.13.45.45,0,0,1,.14.33Z" />
    </SvgIcon>
  );
});

IconMarkdown.displayName = 'IconMarkdown';

export {IconMarkdown};
