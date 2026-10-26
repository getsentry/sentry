import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCopyId(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8.5 8.25a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 1.5 0z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.5 3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H10a.5.5 0 0 1-.5-.5v-5c0-.28.22-.5.5-.5zM11 8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.25 0C15.22 0 16 .78 16 1.75v8.5c0 .97-.78 1.75-1.75 1.75H13v1.25c0 .97-.78 1.75-1.75 1.75h-8.5C1.78 15 1 14.22 1 13.25v-8.5C1 3.78 1.78 3 2.75 3H4V1.75C4 .78 4.78 0 5.75 0zM2.75 4.5a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5q.23-.02.25-.25V12H5.75C4.78 12 4 11.22 4 10.25V4.5zm3-3a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5q.23-.02.25-.25v-8.5a.25.25 0 0 0-.25-.25z"
      />
    </SvgIcon>
  );
}
