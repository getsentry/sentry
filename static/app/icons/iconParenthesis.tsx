import styled from '@emotion/styled';

import type {SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  side?: 'left' | 'right';
}

export function IconParenthesis({side = 'left', ...props}: Props) {
  return (
    <StyledIcon
      data-test-id="icon-parenthesis"
      viewBox="0 0 5 26"
      data-paren-side={side}
      fill={props.color ?? 'currentColor'}
      {...props}
    >
      <path d="M0.91 12.95C0.91 12.45 0.96 4.61 1.04 4.16C1.13 3.7 1.24 3.29 1.39 2.9C1.54 2.52 1.71 2.18 1.9 1.86C2.09 1.54 2.3 1.26 2.51 1.02C2.72 0.77 2.94 0.57 3.16 0.4C3.38 0.23 3.6 0.09 3.81 0L4.09 0.75C3.96 0.84 3.84 0.94 3.71 1.06C3.59 1.18 3.46 1.32 3.34 1.48C3.18 1.7 3.02 1.95 2.87 2.25C2.72 2.54 2.6 2.87 2.49 3.21C2.4 3.54 2.32 3.9 2.26 4.3C2.21 4.69 2.18 12.48 2.18 12.94V13.06C2.18 13.51 2.21 21.29 2.26 21.68C2.31 22.06 2.38 22.39 2.45 22.66C2.55 22.98 2.65 23.28 2.78 23.56C2.9 23.83 3.03 24.08 3.17 24.29C3.31 24.51 3.46 24.7 3.62 24.86C3.78 25.03 3.93 25.17 4.09 25.28L3.81 26C3.6 25.91 3.38 25.77 3.16 25.6C2.94 25.43 2.72 25.23 2.51 24.98C2.29 24.74 2.09 24.46 1.89 24.14C1.7 23.83 1.53 23.48 1.39 23.09C1.24 22.71 1.13 22.3 1.04 21.85C0.96 21.4 0.91 13.56 0.91 13.05V12.95Z" />
    </StyledIcon>
  );
}

const StyledIcon = styled('svg')`
  &[data-paren-side='right'] {
    transform: rotate(180deg);
  }
`;
