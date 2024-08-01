import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconGraphArea = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.25,16.09H.75c-.26,0-.51-.14-.64-.37-.13-.23-.14-.51-.01-.74L5.92,4.25c.26-.48,1.06-.48,1.32,0l2.47,4.56L14.6.47c.17-.29.51-.43.84-.34.33.09.55.38.55.72v14.49c0,.41-.34.75-.75.75ZM2.01,14.59h12.49V3.61l-4.17,7.1c-.13.23-.38.37-.65.37h-.01c-.27,0-.52-.15-.65-.39l-2.45-4.51L2.01,14.59Z" />
    </SvgIcon>
  );
});

IconGraphArea.displayName = 'IconGraphArea';

export {IconGraphArea};
