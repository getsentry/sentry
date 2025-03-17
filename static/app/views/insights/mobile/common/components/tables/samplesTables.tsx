import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {SpanOpSelector} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';
import {DeviceClassSelector} from 'sentry/views/insights/mobile/common/components/deviceClassSelector';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';

const EVENT = 'event';
const SPANS = 'spans';

interface EventSamplesProps {
  cursorName: string;
  footerAlignedPagination: boolean;
  sortKey: string;
  transaction: string;
  release?: string;
}

export interface SpanOperationTableProps {
  transaction: string;
  primaryRelease?: string;
  secondaryRelease?: string;
}

interface SamplesTablesProps {
  EventSamples: React.ComponentType<EventSamplesProps> | undefined;
  SpanOperationTable: React.ComponentType<SpanOperationTableProps>;
  transactionName: string;
}

export function SamplesTables({
  transactionName,
  EventSamples,
  SpanOperationTable,
}: SamplesTablesProps) {
  const [sampleType, setSampleType] = useState<typeof EVENT | typeof SPANS>(SPANS);
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const content = useMemo(() => {
    if (sampleType === EVENT) {
      return (
        <EventSplitContainer>
          <ErrorBoundary mini>
            {EventSamples && (
              <EventSamples
                cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                release={primaryRelease}
                transaction={transactionName}
                footerAlignedPagination
              />
            )}
          </ErrorBoundary>
          <ErrorBoundary mini>
            {EventSamples && (
              <EventSamples
                cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                release={secondaryRelease}
                transaction={transactionName}
                footerAlignedPagination
              />
            )}
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
  }, [
    EventSamples,
    SpanOperationTable,
    primaryRelease,
    sampleType,
    secondaryRelease,
    transactionName,
  ]);

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
          <SubregionSelector />
        </FiltersContainer>
        {EventSamples && (
          <SegmentedControl
            onChange={value => setSampleType(value)}
            defaultValue={SPANS}
            label={t('Sample Type Selection')}
          >
            <SegmentedControl.Item key={SPANS} aria-label={t('By Spans')}>
              {t('By Spans')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key={EVENT} aria-label={t('By Event')}>
              {t('By Event')}
            </SegmentedControl.Item>
          </SegmentedControl>
        )}
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
