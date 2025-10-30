import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';

export function LineCoverageLegend() {
  return (
    <Flex gap="2xl" align="center" direction="row">
      <CoveredLine>Line covered by tests</CoveredLine>
      <UncoveredLine>Line uncovered by tests</UncoveredLine>
      <PartiallyCoveredLine>Line partially covered by tests</PartiallyCoveredLine>
    </Flex>
  );
}

const CoveredLine = styled('div')`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px solid ${p => p.theme.tokens.content.success};
  white-space: nowrap;
`;

const UncoveredLine = styled('div')`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px solid ${p => p.theme.tokens.content.danger};
  white-space: nowrap;
`;

const PartiallyCoveredLine = styled('div')`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px dashed ${p => p.theme.tokens.content.warning};
  white-space: nowrap;
`;
