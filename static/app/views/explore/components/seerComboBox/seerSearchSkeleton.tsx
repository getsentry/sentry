import {useMemo} from 'react';
import styled from '@emotion/styled';

function generateThreeUniqueNumbers(): number[] {
  const numbers: Set<number> = new Set();
  const min = 35;
  const max = 95;

  while (numbers.size < 3) {
    numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  return Array.from(numbers);
}

export function SeerSearchSkeleton() {
  const numbers = useMemo(() => generateThreeUniqueNumbers(), []);

  return (
    <LoadingSkeleton>
      <SkeletonCellsContainer>
        <SkeletonCell>
          <SkeletonLine width={`${numbers?.[0] ?? 95}%`} />
        </SkeletonCell>
        <SkeletonCell>
          <SkeletonLine width={`${numbers?.[1] ?? 50}%`} />
        </SkeletonCell>
        <SkeletonCell>
          <SkeletonLine width={`${numbers?.[2] ?? 75}%`} />
        </SkeletonCell>
      </SkeletonCellsContainer>
    </LoadingSkeleton>
  );
}

const LoadingSkeleton = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SkeletonCellsContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const SkeletonCell = styled('div')`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;

  &:last-child {
    border-bottom: none;
  }
`;

const SkeletonLine = styled('div')<{width: string}>`
  height: 16px;
  width: ${p => p.width};
  background: ${p => p.theme.blue200};
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      opacity: 1;
    }
  }
`;
