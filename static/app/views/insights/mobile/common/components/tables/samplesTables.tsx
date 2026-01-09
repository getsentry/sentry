import {useMemo, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
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
  const {primaryRelease} = useReleaseSelection();

  const content = useMemo(() => {
    if (sampleType === EVENT) {
      return (
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
      );
    }

    return (
      <ErrorBoundary mini>
        <SpanOperationTable
          transaction={transactionName}
          primaryRelease={primaryRelease}
        />
      </ErrorBoundary>
    );
  }, [EventSamples, SpanOperationTable, primaryRelease, sampleType, transactionName]);

  return (
    <div>
      <Flex justify="between" align="center" marginBottom="md">
        <Flex align="center" gap="md">
          {sampleType === SPANS && (
            <SpanOpSelector
              primaryRelease={primaryRelease}
              transaction={transactionName}
            />
          )}
          <DeviceClassSelector size="md" clearSpansTableCursor />
          <SubregionSelector />
        </Flex>
        {EventSamples && (
          <SegmentedControl
            onChange={value => setSampleType(value)}
            value={sampleType}
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
      </Flex>
      {content}
    </div>
  );
}
