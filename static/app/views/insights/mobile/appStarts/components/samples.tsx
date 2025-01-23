import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const organization = useOrganization();

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
          <DeviceClassSelector
            size="md"
            clearSpansTableCursor
            moduleName={ModuleName.APP_START}
          />
          <SubregionSelector />
        </FiltersContainer>
        <SegmentedControl
          onChange={value => {
            trackAnalytics('insight.app_start.spans.toggle_sample_type', {
              organization,
              type: value,
            });
            setSampleType(value);
          }}
          defaultValue={SPANS}
          aria-label={t('Sample Type Selection')}
        >
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
