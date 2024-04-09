import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconImage = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref} viewBox="0 0 500 500">
      <path d="M0 437.8c0 28.5 23.2 51.6 51.6 51.6h386.2c28.5 0 51.6-23.2 51.6-51.6V51.6c0-28.5-23.2-51.6-51.6-51.6H51.6C23.1 0 0 23.2 0 51.6v386.2zm437.8 27.1H51.6c-14.9 0-27.1-12.2-27.1-27.1v-64.5l92.8-92.8 79.3 79.3c4.8 4.8 12.5 4.8 17.3 0l143.2-143.2 107.8 107.8v113.4c0 14.9-12.2 27.1-27.1 27.1zM51.6 24.5h386.2c14.9 0 27.1 12.2 27.1 27.1v238.1l-99.2-99.1c-4.8-4.8-12.5-4.8-17.3 0L205.2 333.8l-79.3-79.3c-4.8-4.8-12.5-4.8-17.3 0l-84.1 84.1v-287c0-14.9 12.2-27.1 27.1-27.1z" />
      <path d="M151.7 196.1c34.4 0 62.3-28 62.3-62.3s-28-62.3-62.3-62.3-62.3 28-62.3 62.3 27.9 62.3 62.3 62.3zm0-100.1c20.9 0 37.8 17 37.8 37.8s-17 37.8-37.8 37.8-37.8-17-37.8-37.8S130.8 96 151.7 96z" />
    </SvgIcon>
  );
});

IconImage.displayName = 'IconImage';

export {IconImage};
