import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconCursorArrow = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M10.3 9.3 15.5 7c.3-.1.5-.4.5-.7 0-.3-.2-.6-.5-.7L1 .1C.7-.1.4 0 .2.2 0 .4-.1.7.1 1l5.6 14.5c0 .3.3.5.6.5s.6-.2.7-.4l2.2-5.2 5.5 5.5c.1.2.3.2.5.2s.4-.1.5-.2c.3-.3.3-.8 0-1.1l-5.4-5.5zm-3.9 4L2.1 2.1l11.2 4.3-4.6 1.9c-.1 0-.2.1-.3.2 0 0 0 .1-.1.1 0 0-.1.1-.1.2l-1.8 4.5z" />
    </SvgIcon>
  );
});

IconCursorArrow.displayName = 'IconCursorArrow';

export {IconCursorArrow};
