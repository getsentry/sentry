import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Orientation} from '@react-types/shared';

import {space} from 'sentry/styles/space';

import type {BaseTabProps} from './tab.chonk';
import {tabsShouldForwardProp} from './utils';

export const ChonkStyledTabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  orientation: Orientation;
  variant: BaseTabProps['variant'];
}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;
  gap: ${p => p.theme.space.xs};

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          grid-auto-flow: column;
          justify-content: start;
        `
      : css`
          height: 100%;
          grid-auto-flow: row;
          align-content: start;
          padding-right: ${space(0.5)};
        `};
`;

export const ChonkStyledTabListOverflowWrap = styled('div')`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: ${p => p.theme.zIndex.dropdown};
`;
