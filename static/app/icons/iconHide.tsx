import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconHide(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path">
      <path d="M13.25,6.75s-1.25,4.25-5.25,4.25S2.75,6.75,2.75,6.75" />
      <line x1="13" y1="7.75" x2="14.25" y2="8.25" />
      <line x1="8" y1="11" x2="8" y2="12.75" />
      <line x1="11.18" y1="10" x2="12.25" y2="11.39" />
      <line x1="3" y1="7.75" x2="1.75" y2="8.25" />
      <line x1="4.82" y1="10" x2="3.75" y2="11.39" />
    </SvgIcon>
  );
}

IconHide.displayName = 'IconHide';

export {IconHide};
