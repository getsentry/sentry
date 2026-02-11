import {css} from '@emotion/react';

/** Defines the styling interface for all avatar components */
export interface BaseAvatarStyleProps {
  round?: boolean;
  size?: number;
  suggested?: boolean;
}

export const baseAvatarStyles = (props: BaseAvatarStyleProps) => css`
  position: absolute;
  top: 0px;
  left: 0px;
  border-radius: ${props.round ? '50%' : '3px'};
  user-select: none;
  filter: ${props.suggested ? 'grayscale(100%)' : 'none'};
`;
