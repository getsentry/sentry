import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'app/components/performance/waterfall/constants';
import {getToggleTheme} from 'app/components/performance/waterfall/utils';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';
import {OmitHtmlDivProps} from 'app/utils';

const TOGGLE_BUTTON_MARGIN_RIGHT = 16;
const TOGGLE_BUTTON_MAX_WIDTH = 30;
export const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;

export const ConnectorBar = styled('div')<{orphanBranch: boolean}>`
  height: 250%;

  border-left: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')} ${p => p.theme.border};
  top: -5px;
  position: absolute;
`;

type TogglerTypes = OmitHtmlDivProps<{
  hasToggler?: boolean;
  isLast?: boolean;
}>;

export const TreeConnector = styled('div')<TogglerTypes & {orphanBranch: boolean}>`
  height: ${p => (p.isLast ? ROW_HEIGHT / 2 : ROW_HEIGHT)}px;
  width: 100%;
  border-left: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')} ${p => p.theme.border};
  position: absolute;
  top: 0;

  &:before {
    content: '';
    height: 1px;
    border-bottom: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')}
      ${p => p.theme.border};

    width: 100%;
    position: absolute;
    bottom: ${p => (p.isLast ? '0' : '50%')};
  }

  &:after {
    content: '';
    background-color: ${p => p.theme.border};
    border-radius: 4px;
    height: 3px;
    width: 3px;
    position: absolute;
    right: 0;
    top: ${ROW_HEIGHT / 2 - 2}px;
  }
`;

type SpanTreeTogglerAndDivProps = OmitHtmlDivProps<{
  isExpanded: boolean;
  disabled: boolean;
  errored: boolean;
}>;

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

  ${p => getToggleTheme(p)}
`;

export const TreeToggleContainer = styled('div')<TogglerTypes>`
  position: relative;
  height: ${ROW_HEIGHT}px;
  width: 40px;
  min-width: 40px;
  margin-right: ${space(1)};
  z-index: ${p => p.theme.zIndex.traceView.spanTreeToggler};
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export const StyledIconChevron = styled(IconChevron)`
  width: 7px;
  margin-left: ${space(0.25)};
`;
