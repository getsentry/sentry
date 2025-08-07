import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {space} from 'sentry/styles/space';

export const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${space(1)};
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
