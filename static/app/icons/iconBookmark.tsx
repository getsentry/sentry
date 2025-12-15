import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isSolid?: boolean;
}

export function IconBookmark({isSolid = false, ...props}: Props) {
  return (
    <SvgIcon {...props}>
      {isSolid ? (
        <path d="M12.25 0C13.22 0 14 0.78 14 1.75V14.25C14 14.54 13.83 14.81 13.56 14.93C13.3 15.05 12.98 15.01 12.76 14.82L8 10.74L3.24 14.82C3.02 15.01 2.7 15.05 2.44 14.93C2.17 14.81 2 14.54 2 14.25V1.75C2 0.78 2.78 0 3.75 0H12.25Z" />
      ) : (
        <path d="M12.25 0C13.22 0 14 0.78 14 1.75V14.25C14 14.54 13.83 14.81 13.56 14.93C13.3 15.05 12.98 15.01 12.76 14.82L8 10.74L3.24 14.82C3.02 15.01 2.7 15.05 2.44 14.93C2.17 14.81 2 14.54 2 14.25V1.75C2 0.78 2.78 0 3.75 0H12.25ZM3.75 1.5C3.61 1.5 3.5 1.61 3.5 1.75V12.62L7.51 9.18L7.62 9.1C7.89 8.94 8.24 8.97 8.49 9.18L12.5 12.62V1.75C12.5 1.61 12.39 1.5 12.25 1.5H3.75Z" />
      )}
    </SvgIcon>
  );
}
