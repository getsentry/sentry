import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconGemini(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path" viewBox="0 0 16 16">
      <path d="M16 8.016A8.522 8.522 0 008.016 16h-.032A8.521 8.521 0 000 8.016v-.032A8.521 8.521 0 007.984 0h.032A8.522 8.522 0 0016 7.984v.032z" />
    </SvgIcon>
  );
}

IconGemini.displayName = 'IconGemini';

export {IconGemini};
