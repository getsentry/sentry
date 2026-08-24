import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import onboardingImg from 'sentry-images/spot/crons-onboarding.svg';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {WorkflowEngineListLayout} from 'sentry/components/workflowEngine/layout/list';
import {IconGlobe, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import type {CronDetector, Detector} from 'sentry/types/workflowEngine/detectors';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
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
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {MonitorEnvironmentLabel} from 'sentry/views/insights/crons/components/overviewTimeline/monitorEnvironmentLabel';
import {GlobalMonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/globalMonitorProcessingErrors';
import {CronServiceIncidents} from 'sentry/views/insights/crons/components/serviceIncidents';
import {
  platformGuides,
  type SupportedPlatform,
} from 'sentry/views/insights/crons/components/upsertPlatformGuides';
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
  const {width: containerWidth} = useDimensions({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const {data: monitorStats, isPending} = useMonitorStats({
    monitors: [detector.dataSources[0].queryObj.id],
    timeWindowConfig,
  });

  return (
    <SimpleTable.RowCell
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
    </SimpleTable.RowCell>
  );
}

const ADDITIONAL_COLUMNS: MonitorListAdditionalColumn[] = [
  {
    id: 'environment-label',
    columnWidth: '120px',
    renderHeaderCell: () => <HeaderCell data-column-name="environment-label" />,
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

function CronEmptyState() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const defaultProject = projects.find(p => p.isMember) ?? projects[0];
  const baseUrl = `${makeMonitorBasePathname(organization.slug)}new/settings/`;

  const makeCreateUrl = (platform: SupportedPlatform) => {
    const platformGuide = platformGuides.find(g => g.platform === platform);
    const guide = platformGuide?.guides?.[0]?.key ?? 'upsert';

    return {
      pathname: baseUrl,
      query: {
        detectorType: 'monitor_check_in_failure',
        project: defaultProject?.id ?? '',
        platform,
        guide,
      },
    };
  };

  return (
    <Panel>
      <EmptyState
        padding="3xl"
        align="center"
        justify="center"
        illustration={
          <Image
            width={{zero: '300px', md: '150px', '2xl': '300px'}}
            src={onboardingImg}
            alt={t(
              'Purple bird emerging from an orange birdhouse with gears and a warning sign'
            )}
          />
        }
        title={t('Monitor Your Cron Jobs')}
        description={t(
          "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
        )}
        action={
          <Stack gap="xl" width="100%">
            <Flex gap="xl" wrap="wrap" width="100%" maxWidth="600px">
              {platformGuides
                .filter(({platform}) => !['cli', 'http'].includes(platform))
                .map(({platform, label}) => (
                  <Stack key={platform} gap="xs" align="center">
                    <PlatformLinkButton
                      variant="secondary"
                      to={makeCreateUrl(platform)}
                      aria-label={t('Create %s Monitor', platform)}
                    >
                      <PlatformIcon platform={platform} format="lg" size="100%" />
                    </PlatformLinkButton>
                    <Text variant="muted">{label}</Text>
                  </Stack>
                ))}
            </Flex>
            <Flex gap="md" wrap="wrap">
              <LinkButton size="sm" icon={<IconTerminal />} to={makeCreateUrl('cli')}>
                Sentry CLI
              </LinkButton>
              <LinkButton size="sm" icon={<IconGlobe />} to={makeCreateUrl('http')}>
                HTTP (cURL)
              </LinkButton>
              <LinkButton
                size="sm"
                to={{
                  pathname: baseUrl,
                  query: {
                    detectorType: 'monitor_check_in_failure',
                    project: defaultProject?.id ?? '',
                    skipGuideDetection: true,
                  },
                }}
              >
                {t('Manual Setup')}
              </LinkButton>
            </Flex>
          </Stack>
        }
      />
    </Panel>
  );
}

const CronsListPageHeader = OverrideOrDefault({
  overrideName: 'component:crons-list-page-header',
});

export default function CronDetectorsList() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'monitor_check_in_failure',
  });

  const selectedProjects = selection.projects.map(String);

  const contextValue = useMemo<MonitorViewContextValue>(() => {
    return {
      additionalColumns: ADDITIONAL_COLUMNS,
      renderTimelineOverlay: ({timeWindowConfig}) => (
        <CronServiceIncidents timeWindowConfig={timeWindowConfig} />
      ),
      renderVisualization: ({detector}) => {
        if (!detector) {
          return (
            <SimpleTable.RowCell
              data-column-name="visualization"
              padding="lg 0"
              borderLeft="muted"
              height="100%"
            >
              <CheckInPlaceholder />
            </SimpleTable.RowCell>
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
          actions={<DetectorListActions />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <CronsListPageHeader organization={organization} />
          <InsightsRedirectNotice>
            {t('Cron monitors have been moved from Insights to Monitors.')}
          </InsightsRedirectNotice>
          <DetectorListHeader
            detectorType="monitor_check_in_failure"
            showTimeRangeSelector
            showTypeFilter={false}
          />
          <GlobalMonitorProcessingErrors project={selectedProjects} />
          <DetectorListContent
            isError={detectorListQuery.isError}
            isLoading={detectorListQuery.isLoading}
            isSuccess={detectorListQuery.isSuccess}
            data={detectorListQuery.data}
            emptyState={<CronEmptyState />}
          />
        </WorkflowEngineListLayout>
      </SentryDocumentTitle>
    </MonitorViewContext.Provider>
  );
}

const TimelineFadeIn = styled('div')`
  width: 100%;
  opacity: 0;
  animation: ${fadeIn} 1s ease-out forwards;
`;

const PlatformLinkButton = styled(LinkButton)`
  width: 80px;
  height: 80px;
  padding: ${p => p.theme.space.lg};
`;
