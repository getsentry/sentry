import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCommand(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 1.25a2.75 2.75 0 1 1 0 5.5h-1.25v2.5H12A2.75 2.75 0 1 1 9.25 12v-1.25h-2.5V12A2.75 2.75 0 1 1 4 9.25h1.25v-2.5H4A2.75 2.75 0 1 1 6.75 4v1.25h2.5V4A2.75 2.75 0 0 1 12 1.25m-8 9.5A1.25 1.25 0 1 0 5.25 12v-1.25zM10.75 12A1.25 1.25 0 1 0 12 10.75h-1.25zm-4-2.75h2.5v-2.5h-2.5zM4 2.75a1.25 1.25 0 1 0 0 2.5h1.25V4c0-.69-.56-1.25-1.25-1.25m8 0c-.69 0-1.25.56-1.25 1.25v1.25H12a1.25 1.25 0 1 0 0-2.5" />
    </SvgIcon>
  );
}
