import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {EventSamples} from 'sentry/views/starfish/views/appStartup/screenSummary/eventSamples';
import {SpanOperationTable} from 'sentry/views/starfish/views/appStartup/screenSummary/spanOperationTable';
import {SpanOpSelector} from 'sentry/views/starfish/views/appStartup/screenSummary/spanOpSelector';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/starfish/views/screens/constants';
import {DeviceClassSelector} from 'sentry/views/starfish/views/screens/screenLoadSpans/deviceClassSelector';

const EVENT = 'event';
const SPANS = 'spans';

export function SamplesTables({transactionName}) {
  const [sampleType, setSampleType] = useState<typeof EVENT | typeof SPANS>(SPANS);
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const content = useMemo(() => {
    if (sampleType === EVENT) {
      return (
        <EventSplitContainer>
          <ErrorBoundary mini>
            <div>
              <EventSamples
                cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                release={primaryRelease}
                transaction={transactionName}
                footerAlignedPagination
              />
            </div>
          </ErrorBoundary>
          <ErrorBoundary mini>
            <div>
              <EventSamples
                cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                release={secondaryRelease}
                transaction={transactionName}
                footerAlignedPagination
              />
            </div>
          </ErrorBoundary>
        </EventSplitContainer>
      );
    }

    return (
      <ErrorBoundary mini>
        <SpanOperationTable
          transaction={transactionName}
          primaryRelease={primaryRelease}
          secondaryRelease={secondaryRelease}
        />
      </ErrorBoundary>
    );
  }, [primaryRelease, sampleType, secondaryRelease, transactionName]);

  return (
    <div>
      <Controls>
        <FiltersContainer>
          {sampleType === SPANS && (
            <SpanOpSelector
              primaryRelease={primaryRelease}
              transaction={transactionName}
              secondaryRelease={secondaryRelease}
            />
          )}
          <DeviceClassSelector size="md" clearSpansTableCursor />
        </FiltersContainer>
        <SegmentedControl onChange={value => setSampleType(value)} defaultValue={SPANS}>
          <SegmentedControl.Item key={SPANS}>{t('By Spans')}</SegmentedControl.Item>
          <SegmentedControl.Item key={EVENT}>{t('By Event')}</SegmentedControl.Item>
        </SegmentedControl>
      </Controls>
      {content}
    </div>
  );
}

const EventSplitContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1.5)};
`;

const Controls = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const FiltersContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
