import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface SegmentedLoadingBarProps {
  /**
   * The index of the segment that is currently active. The active segment is
   * highlighted by a pulsing animation.
   */
  phase: number;

  /**
   * The number of segments to display.
   */
  segments: number;
}

export function SegmentedLoadingBar({segments = 3, phase = 0}: SegmentedLoadingBarProps) {
  return (
    <LoadingBarContainer>
      {Array.from({length: segments}).map((_, index) => (
        <LoadingBarSegment
          key={index}
          isActive={index === phase}
          isCompleted={index < phase}
        />
      ))}
    </LoadingBarContainer>
  );
}

const LoadingBarContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: ${space(0.5)};
  width: 100%;
`;

const LoadingBarSegment = styled('div')<{isActive?: boolean; isCompleted?: boolean}>`
  flex: 1;
  height: 6px;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  ${p =>
    p.isActive &&
    `
    background-color: ${p.theme.gray200};
    animation: pulse 500ms ease-in-out infinite alternate-reverse;
  `}
  ${p =>
    p.isCompleted &&
    `
    background-color: ${p.theme.gray200};
  `}

  @keyframes pulse {
    0% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;
