import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

export function TimelinePlaceholder({count}: {count: number}) {
  return (
    <TimelinePlaceholderContainer>
      {new Array(count).fill(null).map((_, i) => (
        <PlaceholderTick
          key={i}
          style={{
            left: `${(i * (100 / count)).toFixed(2)}%`,
            animationDelay: `${(i / count).toFixed(2)}s`,
          }}
        />
      ))}
    </TimelinePlaceholderContainer>
  );
}

const TimelinePlaceholderContainer = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
`;

const placeholderTickKeyframes = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.75) translateZ(0);
    filter: blur(12px);
  }
  33.33% {
    opacity: 1;
    transform: scale(1) translateZ(0);
    filter: blur(0px);
  }
  66.66% {
    opacity: 1;
    transform: scale(1) translateZ(0);
    filter: blur(0px);
  }
  100% {
    opacity: 0;
    transform: scale(0.75) translateZ(0);
    filter: blur(12px);
  }
`;

const PlaceholderTick = styled('div')`
  position: absolute;
  margin-top: 1px;
  background: ${p => p.theme.translucentBorder};
  width: 4px;
  height: 14px;
  border-radius: 2px;

  opacity: 0;
  transform: scale(0.75) translateZ(0);
  filter: blur(12px);
  animation: ${placeholderTickKeyframes} 2s ease-out forwards infinite;
`;
