import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import IdBadge from 'sentry/components/idBadge';

export function ProjectBadgeContainer(props: FlexProps) {
  return <Flex align="center" {...props} />;
}

export const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
