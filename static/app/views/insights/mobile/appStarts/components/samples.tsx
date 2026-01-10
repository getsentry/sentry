import {useMemo, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {EventSamples} from 'sentry/views/insights/mobile/appStarts/components/eventSamples';
import {SpanOpSelector} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';
import {SpanOperationTable} from 'sentry/views/insights/mobile/appStarts/components/tables/spanOperationTable';
import {DeviceClassSelector} from 'sentry/views/insights/mobile/common/components/deviceClassSelector';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';
import {ModuleName} from 'sentry/views/insights/types';

const EVENT = 'event';
const SPANS = 'spans';

export function SamplesTables({transactionName}: any) {
  const [sampleType, setSampleType] = useState<typeof EVENT | typeof SPANS>(SPANS);
  const {primaryRelease} = useReleaseSelection();
  const organization = useOrganization();

  const content = useMemo(() => {
    if (sampleType === EVENT) {
      return (
        <ErrorBoundary mini>
          <EventSamples
            cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
            sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
            release={primaryRelease}
            transaction={transactionName}
            footerAlignedPagination
          />
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
  }, [primaryRelease, sampleType, transactionName]);

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
          <DeviceClassSelector
            size="md"
            clearSpansTableCursor
            moduleName={ModuleName.APP_START}
          />
          <SubregionSelector />
        </Flex>
        <SegmentedControl
          onChange={value => {
            trackAnalytics('insight.app_start.spans.toggle_sample_type', {
              organization,
              type: value,
            });
            setSampleType(value);
          }}
          value={sampleType}
          aria-label={t('Sample Type Selection')}
        >
          <SegmentedControl.Item key={SPANS}>{t('By Spans')}</SegmentedControl.Item>
          <SegmentedControl.Item key={EVENT}>{t('By Event')}</SegmentedControl.Item>
        </SegmentedControl>
      </Flex>
      {content}
    </div>
  );
}
