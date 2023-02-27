import styled from '@emotion/styled';

import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {getToggleTheme} from 'sentry/components/performance/waterfall/utils';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

const TOGGLE_BUTTON_MARGIN_RIGHT = 16;
export const TOGGLE_BUTTON_MAX_WIDTH = 30;
export const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;
const TREE_TOGGLE_CONTAINER_WIDTH = 40;

export const ConnectorBar = styled('div')<{orphanBranch: boolean}>`
  height: 250%;

  border-left: 2px ${p => (p.orphanBranch ? 'dashed' : 'solid')} ${p => p.theme.border};
  position: absolute;
  top: 0;
`;

type TogglerTypes = {
  hasToggler?: boolean;
  isLast?: boolean;
};

export const TreeConnector = styled('div')<TogglerTypes & {orphanBranch: boolean}>`
  height: ${p => (p.isLast ? ROW_HEIGHT / 2 + 1 : ROW_HEIGHT)}px;
  width: 100%;
  border-left: ${p => `2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};`};
  position: absolute;
  top: 0;

  ${p =>
    p.isLast
      ? `
      border-bottom: 2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};
      border-bottom-left-radius: ${p.theme.borderRadius};`
      : `
      &:before {
        content: '';
        height: 2px;
        left: -2px;
        border-bottom: 2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};
        width: calc(100% - 2px);
        position: absolute;
        bottom: calc(50% - 1px);
      }`}

  &:after {
    content: '';
    background-color: ${p => p.theme.border};
    border-radius: 50%;
    height: 6px;
    width: 6px;
    position: absolute;
    right: 0;
    top: ${ROW_HEIGHT / 2 - 3}px;
  }
`;

type SpanTreeTogglerAndDivProps = {
  disabled: boolean;
  errored: boolean;
  isExpanded: boolean;
  isSpanGroupToggler?: boolean;
  spanBarType?: SpanBarType;
};

export const TreeToggle = styled('div')<SpanTreeTogglerAndDivProps>`
  height: 16px;
  white-space: nowrap;
  min-width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 99px;
  padding: 0px ${space(0.5)};
  transition: all 0.15s ease-in-out;
  font-size: 10px;
  line-height: 0;
  z-index: 1;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${p => getToggleTheme(p)}
`;

export const TreeToggleContainer = styled('div')<TogglerTypes>`
  position: relative;
  height: ${ROW_HEIGHT}px;
  width: ${TREE_TOGGLE_CONTAINER_WIDTH}px;
  min-width: ${TREE_TOGGLE_CONTAINER_WIDTH}px;
  margin-right: ${space(1)};
  z-index: ${p => p.theme.zIndex.traceView.spanTreeToggler};
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export const TreeToggleIcon = styled(IconChevron)`
  width: 7px;
  margin-left: ${space(0.25)};
`;
