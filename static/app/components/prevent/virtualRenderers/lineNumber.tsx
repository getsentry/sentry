import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {VirtualItem, Virtualizer} from '@tanstack/react-virtual';

import {
  LINE_HEIGHT,
  type CoverageValue,
} from 'sentry/components/prevent/virtualRenderers/constants';
import {space} from 'sentry/styles/space';

interface LineNumberProps {
  ariaLabel: string | undefined;
  coverage: CoverageValue | undefined;
  isHighlighted: boolean;
  lineNumber: number | string | null | undefined;
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
  isHighlighted,
  ariaLabel,
}: LineNumberProps) {
  return (
    <LineNumberWrapper
      ref={virtualizer.measureElement}
      key={virtualItem.key}
      data-index={virtualItem.index}
      height={virtualItem.size}
      translateY={virtualItem.start - virtualizer.options.scrollMargin}
      coverage={coverage}
      isHighlighted={isHighlighted}
      hasLineNumber={!!lineNumber}
    >
      <StyledLineNumber onClick={onClick} aria-label={ariaLabel}>
        {isHighlighted ? '#' : null}
        {lineNumber}
      </StyledLineNumber>
    </LineNumberWrapper>
  );
}

// This function generates a pseudo-element that is used to highlight the line number.
// We need to do this because the background color for the highlights has an alpha
// channel, so when a user clicks on it, it mixes with the ColorBar background. Because
// of this, we manually set the main elements background color to that of the code block.
function generatePseudoElement({background}: {background: string}) {
  return css`
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      background-color: ${background};
    }
  `;
}

const LineNumberWrapper = styled('div')<{
  coverage: CoverageValue | undefined;
  hasLineNumber: boolean;
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
  z-index: 2;

  background-color: var(--prism-block-background);

  ${p =>
    p.hasLineNumber &&
    css`
      cursor: pointer;
    `}

  ${p => {
    if (!p.hasLineNumber) {
      return css`
        background-color: var(--prism-block-background);
        border-right: ${space(0.25)} solid ${p.theme.colors.gray200};
      `;
    }

    if (p.isHighlighted) {
      return css`
        ${generatePseudoElement({
          background: p.theme.tokens.background.transparent.accent.muted,
        })}
        border-right: ${space(0.25)} solid ${p.theme.tokens.border.accent.vibrant};
      `;
    }
    if (p.coverage === 'H') {
      return css`
        ${generatePseudoElement({
          background: p.theme.tokens.background.transparent.success.muted,
        })}
        border-right: ${space(0.25)} solid ${p.theme.tokens.border.success.vibrant};
      `;
    }
    if (p.coverage === 'M') {
      return css`
        ${generatePseudoElement({
          background: p.theme.tokens.background.transparent.danger.muted,
        })}
        border-right: ${space(0.25)} solid ${p.theme.tokens.border.danger.vibrant};
      `;
    }
    if (p.coverage === 'P') {
      return css`
        ${generatePseudoElement({
          background: p.theme.tokens.background.transparent.warning.muted,
        })}
        border-right: ${space(0.25)} solid ${p.theme.tokens.border.warning.vibrant};
      `;
    }

    return css`
      background-color: var(--prism-block-background);
      border-right: ${space(0.25)} solid
        ${p.theme.tokens.border.transparent.neutral.muted};
    `;
  }}
`;

const StyledLineNumber = styled('div')`
  height: ${LINE_HEIGHT}px;
  line-height: ${LINE_HEIGHT}px;
`;
