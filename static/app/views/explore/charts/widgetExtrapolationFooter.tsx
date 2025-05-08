import styled from '@emotion/styled';

import {IconArrow, IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';

export function WidgetExtrapolationFooter({
  sampleCount,
  isSampled,
  confidence,
  topEvents,
  dataScanned,
  dataset,
}: {
  confidence: Confidence | undefined;
  dataScanned: 'full' | 'partial' | undefined;
  dataset: DiscoverDatasets;
  isSampled: boolean | null;
  sampleCount: number;
  topEvents: number | undefined;
}) {
  if (![DiscoverDatasets.SPANS_EAP, DiscoverDatasets.SPANS_EAP_RPC].includes(dataset)) {
    return (
      <ConfidenceFooter
        sampleCount={sampleCount}
        isSampled={isSampled}
        confidence={confidence}
        topEvents={topEvents}
        dataScanned={dataScanned}
      />
    );
  }

  return (
    <Container>
      <ExtrapolationMessageWrapper>
        {dataScanned === 'partial' && <IconArrow direction="down" size="xs" />}
        {dataScanned === 'full' && <IconCheckmark size="xs" />}
        <ConfidenceFooter
          sampleCount={sampleCount}
          isSampled={isSampled}
          confidence={confidence}
          topEvents={topEvents}
          dataScanned={dataScanned}
        />
      </ExtrapolationMessageWrapper>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
`;

// Use visibility to hide the footer when the loader is visible
// to prevent layout shift when the loader disappears
const ExtrapolationMessageWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  visibility: visible;
`;
