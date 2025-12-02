import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {InsightsRedirectNotice} from 'sentry/views/detectors/list/common/insightsRedirectNotice';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';
import {
  MonitorViewContext,
  type MonitorViewContextValue,
} from 'sentry/views/detectors/monitorViewContext';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

function VisualizationCell({detector}: {detector: UptimeDetector}) {
  const uptimeDetectorId = detector.id;

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: [uptimeDetectorId],
    timeWindowConfig,
  });

  return (
    <Cell
      data-column-name="visualization"
      padding="lg 0"
      borderLeft="muted"
      height="100%"
    >
      <Flex width="100%" height="100%" ref={elementRef} align="center">
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkStatusPrecedent}
            timeWindowConfig={timeWindowConfig}
            bucketedData={uptimeStats?.[uptimeDetectorId] ?? []}
          />
        )}
      </Flex>
    </Cell>
  );
}

const TITLE = t('Uptime Monitors');
const DESCRIPTION = t(
  'Uptime monitors continuously track configured URLs, delivering alerts and insights to quickly identify downtime and troubleshoot issues.'
);
const DOCS_URL = 'https://docs.sentry.io/product/alerts/uptime-monitoring/';

export default function UptimeDetectorsList() {
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'uptime_domain_failure',
  });

  const contextValue = useMemo<MonitorViewContextValue>(
    () => ({
      renderVisualization: ({detector}) => {
        if (!detector) {
          return (
            <Cell
              data-column-name="visualization"
              padding="lg 0"
              borderLeft="muted"
              height="100%"
            >
              <CheckInPlaceholder />
            </Cell>
          );
        }
        if (detector.type === 'uptime_domain_failure') {
          return <VisualizationCell detector={detector} />;
        }
        return null;
      },
    }),
    []
  );

  return (
    <MonitorViewContext.Provider value={contextValue}>
      <SentryDocumentTitle title={TITLE}>
        <WorkflowEngineListLayout
          actions={<DetectorListActions detectorType="uptime_domain_failure" />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <InsightsRedirectNotice>
            {t('Uptime monitors have been moved from Insights to Monitors.')}
          </InsightsRedirectNotice>
          <DetectorListHeader showTimeRangeSelector showTypeFilter={false} />
          <DetectorListContent {...detectorListQuery} />
        </WorkflowEngineListLayout>
      </SentryDocumentTitle>
    </MonitorViewContext.Provider>
  );
}

const Cell = styled(SimpleTable.RowCell)`
  z-index: 4;
`;
