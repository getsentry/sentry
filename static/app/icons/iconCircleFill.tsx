import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated This icon will be removed in new UI.
 */
function IconCircleFill({ref, ...props}: SVGIconProps) {
  return (
    <SvgIcon {...props} ref={ref} viewBox="0 0 24 24" kind="path">
      <circle cx="12" cy="12" r="10" />
    </SvgIcon>
  );
}

IconCircleFill.displayName = 'IconCircleFill';

export {IconCircleFill};
