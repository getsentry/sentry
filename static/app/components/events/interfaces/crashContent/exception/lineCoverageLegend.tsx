import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import {coverageText as COVERAGE_TEXT} from 'sentry/components/events/interfaces/frame/contextLineNumber';
import {Coverage} from 'sentry/types/integrations';

export function LineCoverageLegend() {
  return (
    <Flex gap="2xl" align="center" direction="row" wrap="wrap">
      <SolidLegendEntry paddingRight="md" borderRight="success">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.COVERED]}
        </Text>
      </SolidLegendEntry>
      <SolidLegendEntry paddingRight="md" borderRight="danger">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.NOT_COVERED]}
        </Text>
      </SolidLegendEntry>
      <DashedLegendEntry paddingRight="md" borderRight="warning">
        <Text size="sm" wrap="nowrap">
          {COVERAGE_TEXT[Coverage.PARTIAL]}
        </Text>
      </DashedLegendEntry>
    </Flex>
  );
}

const SolidLegendEntry = styled(Container)`
  border-right-width: 3px;
  border-right-style: solid;
`;

const DashedLegendEntry = styled(Container)`
  border-right-width: 3px;
  border-right-style: dashed;
`;
