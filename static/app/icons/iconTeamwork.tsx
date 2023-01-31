import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconTeamwork = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="m5.9,5.97c.92,0,1.44-.5,1.44-1.37,0-.82-.57-1.37-1.41-1.37h-2.08v-1.54c0-1.11-.8-1.69-1.58-1.69S.69.58.69,1.69v10.62c0,2.55,1.02,3.69,3.3,3.69,1.23,0,1.94-.32,2.47-.63.4-.22.55-.7.55-1.07,0-.68-.46-1.44-1.11-1.44-.09,0-.18.02-.28.05-.03.01-.07.03-.12.05-.17.08-.41.19-.75.19-.41,0-.88-.14-.88-1.27v-5.91h2.04Z" />
      <path d="m12.53,10.44c-1.53,0-2.78,1.25-2.78,2.78s1.25,2.78,2.78,2.78,2.78-1.25,2.78-2.78-1.25-2.78-2.78-2.78Z" />
    </SvgIcon>
  );
});

IconTeamwork.displayName = 'IconTeamwork';

export {IconTeamwork};
