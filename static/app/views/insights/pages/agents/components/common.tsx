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
  background-color: ${p => p.theme.tokens.background.primary};
  opacity: 0.5;
  z-index: 1;
`;

export const CellLink = styled(Link)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
