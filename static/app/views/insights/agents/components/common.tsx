import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';

export const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${p => p.theme.space.md};
`;

export const LoadingOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.background};
  opacity: 0.5;
  z-index: 1;
`;

export const CellLink = styled(Link)`
  ${p => p.theme.overflowEllipsis}
`;
