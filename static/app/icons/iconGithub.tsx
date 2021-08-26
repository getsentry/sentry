import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGithub = React.forwardRef(function IconGithub(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,.25A7.94,7.94,0,0,0,5.47,15.74c.4.07.55-.18.55-.39S6,14.66,6,14c-2.23.48-2.7-1.06-2.7-1.06a2.12,2.12,0,0,0-.89-1.17c-.72-.49.06-.48.06-.48a1.68,1.68,0,0,1,1.22.82A1.72,1.72,0,0,0,6,12.77a1.68,1.68,0,0,1,.51-1.06c-1.78-.2-3.64-.88-3.64-3.93a3,3,0,0,1,.82-2.13,2.82,2.82,0,0,1,.08-2.1s.67-.22,2.2.81a7.84,7.84,0,0,1,2-.27,7.84,7.84,0,0,1,2,.27c1.53-1,2.2-.81,2.2-.81a2.82,2.82,0,0,1,.08,2.1,3,3,0,0,1,.82,2.13c0,3.05-1.87,3.73-3.65,3.92A1.89,1.89,0,0,1,10,13.17c0,1.07,0,1.92,0,2.18s.15.46.55.39A7.94,7.94,0,0,0,8,.25" />
    </SvgIcon>
  );
});

IconGithub.displayName = 'IconGithub';

export {IconGithub};
