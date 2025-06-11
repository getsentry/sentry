import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconPrevent(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path">
      <path class="cls-1" d="M8.02,2.75c-1.5,1-4,1.5-5,1.5,0,6.75,3,8.75,5,9,2-.25,5-2.25,5-9-1,0-3.5-.5-5-1.5Z"/>
    </SvgIcon>
  );
}

IconPrevent.displayName = 'IconPrevent';

export {IconPrevent};
