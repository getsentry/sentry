import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text/text';
import {coverageText as COVERAGE_TEXT} from 'sentry/components/events/interfaces/frame/contextLineNumber';
import {Coverage} from 'sentry/types/integrations';

export function LineCoverageLegend() {
  return (
    <Flex gap="2xl" align="center" direction="row" wrap="wrap">
      <CoveredLine>{COVERAGE_TEXT[Coverage.COVERED]}</CoveredLine>
      <UncoveredLine>{COVERAGE_TEXT[Coverage.NOT_COVERED]}</UncoveredLine>
      <PartiallyCoveredLine>{COVERAGE_TEXT[Coverage.PARTIAL]}</PartiallyCoveredLine>
    </Flex>
  );
}

const CoveredLine = styled(Text)`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px solid ${p => p.theme.green400};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.sm};
`;

const UncoveredLine = styled(Text)`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px solid ${p => p.theme.red300};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.sm};
`;

const PartiallyCoveredLine = styled(Text)`
  padding-right: ${p => p.theme.space.md};
  border-right: 3px dashed ${p => p.theme.yellow300};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.sm};
`;
