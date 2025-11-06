import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import {coverageText as COVERAGE_TEXT} from 'sentry/components/events/interfaces/frame/contextLineNumber';
import {Coverage} from 'sentry/types/integrations';

export function LineCoverageLegend() {
  return (
    <Flex gap="2xl" align="center" direction="row" wrap="wrap">
      <LegendEntry paddingRight="md" borderRight="success">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.COVERED]}
        </Text>
      </LegendEntry>
      <LegendEntry paddingRight="md" borderRight="danger">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.NOT_COVERED]}
        </Text>
      </LegendEntry>
      <LegendEntry paddingRight="md" borderRight="warning">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.PARTIAL]}
        </Text>
      </LegendEntry>
    </Flex>
  );
}

const LegendEntry = styled(Container)`
  border-right-width: 3px;
`;
