import {css} from '@emotion/react';

export type ImageStyleProps = {
  round?: boolean;
  suggested?: boolean;
};

export const imageStyle = (props: ImageStyleProps) => css`
  position: absolute;
  top: 0px;
  left: 0px;
  border-radius: ${props.round ? '50%' : '3px'};
  ${props.suggested &&
  css`
    filter: grayscale(100%);
  `}
`;
