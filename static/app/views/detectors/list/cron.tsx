import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import type {CronDetector, Detector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HeaderCell} from 'sentry/views/detectors/components/detectorListTable';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {InsightsRedirectNotice} from 'sentry/views/detectors/list/common/insightsRedirectNotice';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';
import {
  MonitorViewContext,
  type MonitorListAdditionalColumn,
  type MonitorViewContextValue,
} from 'sentry/views/detectors/monitorViewContext';
import {CronsLandingPanel} from 'sentry/views/insights/crons/components/cronsLandingPanel';
import MonitorEnvironmentLabel from 'sentry/views/insights/crons/components/overviewTimeline/monitorEnvironmentLabel';
import {GlobalMonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/globalMonitorProcessingErrors';
import {
  checkInStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/crons/utils';
import {selectCheckInData} from 'sentry/views/insights/crons/utils/selectCheckInData';
import {useMonitorStats} from 'sentry/views/insights/crons/utils/useMonitorStats';

function VisualizationCell({detector}: {detector: CronDetector}) {
  const cronId = detector.dataSources[0].queryObj.id;
  const cronEnvironments = detector.dataSources[0].queryObj.environments;

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const {data: monitorStats, isPending} = useMonitorStats({
    monitors: [detector.dataSources[0].queryObj.id],
    timeWindowConfig,
  });

  return (
    <Cell
      data-column-name="visualization"
      padding="lg 0"
      borderLeft="muted"
      height="100%"
    >
      <Stack gap="sm" width="100%" ref={elementRef}>
        {cronEnvironments.map(environment => {
          if (isPending) {
            return <CheckInPlaceholder key={environment.name} />;
          }
          return (
            <TimelineFadeIn key={environment.name}>
              <CheckInTimeline
                statusLabel={statusToText}
                statusStyle={tickStyle}
                statusPrecedent={checkInStatusPrecedent}
                timeWindowConfig={timeWindowConfig}
                bucketedData={selectCheckInData(
                  monitorStats?.[cronId] ?? [],
                  environment.name
                )}
              />
            </TimelineFadeIn>
          );
        })}
      </Stack>
    </Cell>
  );
}

const ADDITIONAL_COLUMNS: MonitorListAdditionalColumn[] = [
  {
    id: 'environment-label',
    columnWidth: '120px',
    renderHeaderCell: () => (
      <HeaderCell data-column-name="environment-label" sort={undefined} />
    ),
    renderCell: (detector: Detector) => {
      if (detector.type !== 'monitor_check_in_failure') {
        return null;
      }
      return (
        <SimpleTable.RowCell data-column-name="environment-label" alignSelf="start">
          <Stack gap="sm" width="100%">
            {detector.dataSources[0].queryObj.environments.map(environment => {
              return (
                <Text density="compressed" key={environment.name}>
                  <MonitorEnvironmentLabel
                    monitorEnv={environment}
                    key={environment.name}
                  />
                </Text>
              );
            })}
          </Stack>
        </SimpleTable.RowCell>
      );
    },
  },
];

const TITLE = t('Cron Monitors');
const DESCRIPTION = t(
  "Cron monitors check in on recurring jobs and tell you if they're running on schedule, failing, or succeeding."
);
const DOCS_URL = 'https://docs.sentry.io/product/crons/';

export default function CronDetectorsList() {
  const {selection} = usePageFilters();
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'monitor_check_in_failure',
  });

  const selectedProjects = selection.projects.map(String);

  const contextValue = useMemo<MonitorViewContextValue>(() => {
    return {
      additionalColumns: ADDITIONAL_COLUMNS,
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
        if (detector.type === 'monitor_check_in_failure') {
          return <VisualizationCell detector={detector} />;
        }
        return null;
      },
    };
  }, []);

  return (
    <MonitorViewContext.Provider value={contextValue}>
      <SentryDocumentTitle title={TITLE}>
        <WorkflowEngineListLayout
          actions={<DetectorListActions detectorType="monitor_check_in_failure" />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <InsightsRedirectNotice>
            {t('Cron monitors have been moved from Insights to Monitors.')}
          </InsightsRedirectNotice>
          <DetectorListHeader showTimeRangeSelector showTypeFilter={false} />
          <GlobalMonitorProcessingErrors project={selectedProjects} />
          <DetectorListContent
            {...detectorListQuery}
            emptyState={<CronsLandingPanel />}
          />
        </WorkflowEngineListLayout>
      </SentryDocumentTitle>
    </MonitorViewContext.Provider>
  );
}

const Cell = styled(SimpleTable.RowCell)`
  z-index: 4;
`;

const TimelineFadeIn = styled('div')`
  width: 100%;
  opacity: 0;
  animation: ${fadeIn} 1s ease-out forwards;
`;
