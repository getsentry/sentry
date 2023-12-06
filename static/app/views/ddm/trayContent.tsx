import styled from '@emotion/styled';

import {TraceTable} from 'sentry/views/ddm/traceTable';

export function TrayContent() {
  return (
    <TrayWrapper>
      <TraceTable />
    </TrayWrapper>
  );
}

const TrayWrapper = styled('div')`
  height: 100%;
  background-color: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.innerBorder};
  z-index: ${p => p.theme.zIndex.sidebar};
`;
