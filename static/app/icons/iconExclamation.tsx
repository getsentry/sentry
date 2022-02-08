import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconExclamation = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <g>
        <path d="M8.88588 1.41773L8.88588 10.0778C8.88588 10.4386 8.53153 10.6552 8.05907 10.6552C7.5866 10.6552 7.11414 10.4386 7.11414 10.0778L7.11414 1.41773C7.11414 1.12906 7.46848 0.840389 8.05907 0.840388C8.64965 0.840388 8.88588 1.12906 8.88588 1.41773Z" />
        <path d="M7.99999 12.9559C7.32513 12.9559 6.77805 13.5018 6.77805 14.1752C6.77805 14.8485 7.32513 15.3944 7.99998 15.3944C8.67484 15.3944 9.22192 14.8485 9.22192 14.1752C9.22192 13.5018 8.67484 12.9559 7.99999 12.9559Z" />
      </g>
    </SvgIcon>
  );
});

IconExclamation.displayName = 'IconExclamation';

export {IconExclamation};
