import {css} from '@emotion/core';

import theme from 'app/utils/theme';

export type ImageStyleProps = {
  round?: boolean;
  suggested?: boolean;
  grayscale?: boolean;
};

export const imageStyle = (props: ImageStyleProps) => css`
  position: absolute;
  top: 0px;
  left: 0px;
  border-radius: ${props.round ? '50%' : '3px'};
  border: ${props.suggested ? `1px dashed ${theme.gray400}` : 'none'};
  ${props.grayscale &&
  css`
    padding: 1px;
    filter: grayscale(100%);
  `}
`;
