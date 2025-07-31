import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconBot(props: SVGIconProps) {
  return (
    <SvgIcon
      {...props}
      kind="path"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" fill="none" />
      <rect width="16" height="12" x="4" y="8" rx="2" fill="none" />
      <path d="M2 14h2" fill="none" />
      <path d="M20 14h2" fill="none" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </SvgIcon>
  );
}

IconBot.displayName = 'IconBot';

export {IconBot};
