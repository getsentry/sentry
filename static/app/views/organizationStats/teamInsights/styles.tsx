import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import IdBadge from 'sentry/components/idBadge';

export const ProjectBadgeContainer = Flex;

export const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

// Override default flex styles for ProjectBadgeContainer
ProjectBadgeContainer.defaultProps = {
  align: 'center',
};
