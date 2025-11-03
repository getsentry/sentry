import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {coverageText as COVERAGE_TEXT} from 'sentry/components/events/interfaces/frame/contextLineNumber';
import {Coverage} from 'sentry/types/integrations';

export function LineCoverageLegend() {
  return (
    <Flex gap="2xl" align="center" direction="row" paddingBottom="md">
      <CoveredLine>{COVERAGE_TEXT[Coverage.COVERED]}</CoveredLine>
      <UncoveredLine>{COVERAGE_TEXT[Coverage.NOT_COVERED]}</UncoveredLine>
      <PartiallyCoveredLine>{COVERAGE_TEXT[Coverage.PARTIAL]}</PartiallyCoveredLine>
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
