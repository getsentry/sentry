import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconCompass(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path">
      <path d="M8 .063a7.937 7.937 0 1 1 0 15.874A7.937 7.937 0 0 1 8 .063Zm0 1.5a6.438 6.438 0 1 0 0 12.875A6.438 6.438 0 0 0 8 1.562Zm2.412 3.075a.751.751 0 0 1 .95.949l-1.326 3.975a.75.75 0 0 1-.474.474l-3.975 1.325a.75.75 0 0 1-.95-.949l1.326-3.975.033-.082a.751.751 0 0 1 .441-.392l3.975-1.325ZM7.267 7.267l-.732 2.197 2.196-.733.733-2.196-2.197.732Z" />
    </SvgIcon>
  );
}

IconCompass.displayName = 'IconCompass';

export {IconCompass};
