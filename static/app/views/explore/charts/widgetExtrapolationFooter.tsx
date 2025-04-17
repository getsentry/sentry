import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import {SegmentedLoadingBar} from 'sentry/components/segmentedLoadingBar';
import {IconArrow, IconCheckmark} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';

export function WidgetExtrapolationFooter({
  sampleCount,
  isSampled,
  confidence,
  topEvents,
  dataScanned,
  samplingMode,
  dataset,
}: {
  confidence: Confidence | undefined;
  dataScanned: 'full' | 'partial' | undefined;
  dataset: DiscoverDatasets;
  isSampled: boolean | null;
  sampleCount: number;
  topEvents: number | undefined;
  samplingMode?: SamplingMode;
}) {
  const organization = useOrganization();
  if (
    !organization.features.includes('visibility-explore-progressive-loading') ||
    ![DiscoverDatasets.SPANS_EAP, DiscoverDatasets.SPANS_EAP_RPC].includes(dataset)
  ) {
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

  let loader;
  // Show the loader if we haven't received best effort results yet
  if (samplingMode !== SAMPLING_MODE.BEST_EFFORT) {
    const currentPhase = samplingMode === SAMPLING_MODE.PREFLIGHT ? 1 : 0;
    loader = (
      <div
        data-test-id="progressive-loading-indicator"
        style={{
          width: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SegmentedLoadingBar
          segments={2}
          phase={currentPhase}
          getTooltipText={phase =>
            defined(samplingMode) && phase <= currentPhase
              ? tct(
                  'Chart is based on [sampleCount] samples and is currently loading more data',
                  {
                    sampleCount: <Count value={sampleCount} />,
                  }
                )
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <Container>
      {loader}
      <ExtrapolationMessageWrapper isVisible={!loader}>
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
const ExtrapolationMessageWrapper = styled('div')<{isVisible: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  visibility: ${p => (p.isVisible ? 'visible' : 'hidden')};
`;
