import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconTrello(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path">
      <path d="M14,0H2A2,2,0,0,0,0,2V14a2,2,0,0,0,2,2H14a2,2,0,0,0,2-2V2A2,2,0,0,0,14,0ZM7,12.12a1,1,0,0,1-1,1H3a1,1,0,0,1-1-1V3a1,1,0,0,1,1-1H6A1,1,0,0,1,7,3Zm7-4a1,1,0,0,1-1,1H10a1,1,0,0,1-1-1V3a1,1,0,0,1,1-1h3a1,1,0,0,1,1,1Z" />
    </SvgIcon>
  );
}

IconTrello.displayName = 'IconTrello';

export {IconTrello};
