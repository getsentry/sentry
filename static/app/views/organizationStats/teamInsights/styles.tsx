import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {IdBadge} from 'sentry/components/idBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

export const TeamInsightsTable = styled(SimpleTable)`
  font-size: ${p => p.theme.font.size.md};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;

  [role='cell'] {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }
`;

export function ProjectBadgeContainer(props: FlexProps) {
  return <Flex align="center" {...props} />;
}

export const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
