import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSpeechBubble(props: SVGIconProps) {
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
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="none" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </SvgIcon>
  );
}

IconSpeechBubble.displayName = 'IconSpeechBubble';

export {IconSpeechBubble};
