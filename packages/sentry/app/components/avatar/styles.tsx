import {css} from '@emotion/react';

export type ImageStyleProps = {
  grayscale?: boolean;
  round?: boolean;
  suggested?: boolean;
};

export const imageStyle = (props: ImageStyleProps) => css`
  position: absolute;
  top: 0px;
  left: 0px;
  border-radius: ${props.round ? '50%' : '3px'};
  ${props.grayscale &&
  css`
    padding: 1px;
    filter: grayscale(100%);
  `}
  ${props.suggested &&
  css`
    opacity: 50%;
  `}
`;
