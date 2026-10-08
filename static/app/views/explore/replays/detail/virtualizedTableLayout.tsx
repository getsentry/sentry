import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

const BodyRow = styled(SimpleTable.Row)<{useTransparentBorders?: boolean}>`
  display: grid;
  position: relative;

  &.beforeHoverTime + &.afterHoverTime:before {
    border-top: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.moderate
          : p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeHoverTime.isLastDataRow:before {
    border-bottom: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.moderate
          : p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }

  &.beforeCurrentTime + &.afterCurrentTime:after {
    border-top: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.vibrant
          : p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeCurrentTime.isLastDataRow:after {
    border-bottom: 1px solid
      ${p =>
        p.useTransparentBorders
          ? p.theme.tokens.border.transparent.accent.vibrant
          : p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }
`;

export const VirtualTable = {BodyRow};
