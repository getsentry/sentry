import {css} from '@emotion/react';
import type {Orientation} from '@react-types/shared';

import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

import type {BaseTabProps} from './tab.chonk';
import {tabsShouldForwardProp} from './utils';

export const ChonkStyledTabListWrap = chonkStyled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  hideBorder: boolean;
  orientation: Orientation;
  variant: BaseTabProps['variant'];
}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          grid-auto-flow: column;
          justify-content: start;
          gap: ${space(2)};
          ${!p.hideBorder && `border-bottom: solid 1px ${p.theme.border};`}
        `
      : css`
          height: 100%;
          grid-auto-flow: row;
          align-content: start;
          gap: 1px;
          padding-right: ${space(0.5)};
          ${!p.hideBorder && `border-right: solid 1px ${p.theme.border};`}
        `};
`;
