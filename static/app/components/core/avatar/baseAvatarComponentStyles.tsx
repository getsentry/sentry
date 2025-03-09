import {css} from '@emotion/react';

export interface BaseAvatarComponentProps {
  round?: boolean;
  suggested?: boolean;
}

export const BaseAvatarComponentStyles = (props: BaseAvatarComponentProps) => css`
  position: absolute;
  top: 0px;
  left: 0px;
  border-radius: ${props.round ? '50%' : '3px'};
  user-select: none;
  filter: ${props.suggested ? 'grayscale(100%)' : 'none'};
`;
