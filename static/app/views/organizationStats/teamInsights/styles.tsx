import styled from '@emotion/styled';

import IdBadge from 'sentry/components/idBadge';

export const ProjectBadgeContainer = styled('div')`
  display: flex;
  align-items: center;
`;

export const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
