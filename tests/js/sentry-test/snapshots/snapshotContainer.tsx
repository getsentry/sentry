import type {ReactNode} from 'react';
import styled from '@emotion/styled';

interface SnapshotContainerProps {
  fillWidth: boolean;
  width: number;
  children?: ReactNode;
}

export function SnapshotContainer({children, fillWidth, width}: SnapshotContainerProps) {
  return (
    <QueryContainer id="snapshot-container" style={{width}}>
      <div id="root" style={{display: fillWidth ? 'block' : 'inline-block', padding: 8}}>
        {children}
      </div>
    </QueryContainer>
  );
}

const QueryContainer = styled('div')`
  container-type: inline-size;
`;
