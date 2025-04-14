import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {VirtualItem, Virtualizer} from '@tanstack/react-virtual';

import {
  type CoverageMap,
  LINE_HEIGHT,
} from 'sentry/components/codecov/virtualRenderers/constants';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

interface LineNumberProps {
  coverage: CoverageMap;
  lineNumber: number;
  onClick: () => void;
  virtualItem: VirtualItem;
  virtualizer: Virtualizer<Window, Element>;
}

export const LineNumberColumn = styled('div')`
  position: relative;
  z-index: 2;
  height: 100%;
  width: 86px;
  min-width: 86px;
  padding-right: 10px;
`;

export function LineNumber({
  coverage,
  lineNumber,
  onClick,
  virtualItem,
  virtualizer,
}: LineNumberProps) {
  const location = useLocation();
  const isHighlighted = location.hash === `#L${lineNumber}`;

  return (
    <LineNumberWrapper
      ref={virtualizer.measureElement}
      key={virtualItem.key}
      data-index={virtualItem.index}
      height={virtualItem.size}
      translateY={virtualItem.start - virtualizer.options.scrollMargin}
      coverage={coverage.get(lineNumber)?.coverage}
      isHighlighted={isHighlighted}
    >
      <StyledLineNumber onClick={onClick}>
        {isHighlighted ? '#' : null}
        {lineNumber}
      </StyledLineNumber>
    </LineNumberWrapper>
  );
}

const LineNumberWrapper = styled('div')<{
  coverage: 'H' | 'M' | 'P' | undefined;
  height: number;
  isHighlighted: boolean;
  translateY: number;
}>`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  user-select: none;
  padding-left: ${space(1)};
  padding-right: ${space(2)};
  text-align: right;
  height: ${p => p.height}px;
  transform: translateY(${p => p.translateY}px);

  &:hover {
    cursor: pointer;
  }

  ${p => {
    if (p.isHighlighted) {
      return css`
        background-color: ${p.theme.blue100};
        border-right: ${space(0.25)} solid ${p.theme.blue300};
      `;
    }
    if (p.coverage === 'H') {
      return css`
        background-color: ${p.theme.green100};
        border-right: ${space(0.25)} solid ${p.theme.green300};
      `;
    }
    if (p.coverage === 'M') {
      return css`
        background-color: ${p.theme.red100};
        border-right: ${space(0.25)} solid ${p.theme.red300};
      `;
    }
    if (p.coverage === 'P') {
      return css`
        background-color: ${p.theme.yellow100};
        border-right: ${space(0.25)} solid ${p.theme.yellow300};
      `;
    }

    return css`
      background-color: inherit;
      border-right: ${space(0.25)} solid ${p.theme.gray200};
    `;
  }}
`;

const StyledLineNumber = styled('div')`
  height: ${LINE_HEIGHT}px;
  line-height: ${LINE_HEIGHT}px;
`;
