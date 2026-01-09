import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {t, tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  CronDetector,
  Detector,
  MetricCondition,
  MetricDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import getDuration from 'sentry/utils/duration/getDuration';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {unreachable} from 'sentry/utils/unreachable';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getDetectorSystemCreatedNotice} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

type DetectorLinkProps = {
  detector: Detector;
  className?: string;
  openInNewTab?: boolean;
};

function formatConditionType(condition: MetricCondition) {
  switch (condition.type) {
    case DataConditionType.GREATER:
      return '>';
    case DataConditionType.LESS:
      return '<';
    case DataConditionType.EQUAL:
      return '=';
    case DataConditionType.NOT_EQUAL:
      return '!=';
    case DataConditionType.GREATER_OR_EQUAL:
      return '>=';
    case DataConditionType.LESS_OR_EQUAL:
      return '<=';
    default:
      return condition.type;
  }
}

function formatCondition({condition, unit}: {condition: DataCondition; unit: string}) {
  if (
    !condition.conditionResult ||
    condition.conditionResult === DetectorPriorityLevel.OK
  ) {
    return null;
  }

  const comparison = formatConditionType(condition);
  const threshold = `${condition.comparison}${unit}`;
  const priority =
    DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[
      condition.conditionResult as keyof typeof DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL
    ];

  return `${comparison}${threshold} ${priority}`;
}

function DetailItem({children}: {children: React.ReactNode}) {
  if (!children) {
    return null;
  }

  return (
    <Fragment>
      <Separator />
      <DetailItemContent>{children}</DetailItemContent>
    </Fragment>
  );
}

function MetricDetectorConfigDetails({detector}: {detector: MetricDetector}) {
  const detectionType = detector.config.detectionType;
  const conditions = detector.conditionGroup?.conditions;
  if (!conditions?.length) {
    return null;
  }

  const unit = getMetricDetectorSuffix(
    detectionType,
    detector.dataSources[0].queryObj?.snubaQuery?.aggregate || 'count()'
  );
  switch (detectionType) {
    case 'static': {
      const text = conditions
        .map(condition => formatCondition({condition, unit}))
        .filter(defined)
        .join(', ');
      if (!text) {
        return null;
      }
      return <DetailItem>{text}</DetailItem>;
    }
    case 'percent': {
      const text = conditions
        .map(condition => formatCondition({condition, unit}))
        .filter(defined)
        .join(', ');
      if (!text) {
        return null;
      }
      return <DetailItem>{text}</DetailItem>;
    }
    case 'dynamic':
      return <DetailItem>{t('Dynamic')}</DetailItem>;
    default:
      unreachable(detectionType);
      return null;
  }
}

function MetricDetectorDetails({detector}: {detector: MetricDetector}) {
  const datasetConfig = getDatasetConfig(
    getDetectorDataset(
      detector.dataSources[0].queryObj?.snubaQuery.dataset || Dataset.ERRORS,
      detector.dataSources[0].queryObj?.snubaQuery.eventTypes || []
    )
  );
  return (
    <Fragment>
      {detector.dataSources.map(dataSource => {
        if (!dataSource.queryObj) {
          return null;
        }
        return (
          <Fragment key={dataSource.id}>
            <DetailItem>{dataSource.queryObj.snubaQuery.environment}</DetailItem>
            <DetailItem>
              {datasetConfig.fromApiAggregate(dataSource.queryObj.snubaQuery.aggregate)}
            </DetailItem>
            <DetailItem>
              {middleEllipsis(
                datasetConfig.toSnubaQueryString(dataSource.queryObj.snubaQuery),
                40
              )}
            </DetailItem>
          </Fragment>
        );
      })}
      <MetricDetectorConfigDetails detector={detector} />
    </Fragment>
  );
}

function UptimeDetectorDetails({detector}: {detector: UptimeDetector}) {
  return (
    <Fragment>
      {detector.dataSources.map(dataSource => {
        return (
          <Fragment key={dataSource.id}>
            <DetailItem>{middleEllipsis(dataSource.queryObj.url, 40)}</DetailItem>
            <DetailItem>
              {tct('Every [duration]', {
                duration: getDuration(dataSource.queryObj.intervalSeconds),
              })}
            </DetailItem>
          </Fragment>
        );
      })}
    </Fragment>
  );
}

function CronDetectorDetails({detector}: {detector: CronDetector}) {
  const config = detector.dataSources[0].queryObj.config;

  return <DetailItem>{scheduleAsText(config)}</DetailItem>;
}

function Details({detector}: {detector: Detector}) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return <MetricDetectorDetails detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeDetectorDetails detector={detector} />;
    case 'monitor_check_in_failure':
      return <CronDetectorDetails detector={detector} />;
    case 'error':
    case 'issue_stream':
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}

export function DetectorLink({detector, className, openInNewTab}: DetectorLinkProps) {
  const org = useOrganization();
  const project = useProjectFromId({project_id: detector.projectId});

  const detectorName =
    detector.type === 'issue_stream'
      ? t('All Issues in %s', project?.slug || 'project')
      : detector.name;

  const detectorLink =
    detector.type === 'issue_stream'
      ? null
      : makeMonitorDetailsPathname(org.slug, detector.id);

  return (
    <TitleCell
      className={className}
      name={detectorName}
      link={detectorLink}
      systemCreated={getDetectorSystemCreatedNotice(detector)}
      disabled={!detector.enabled}
      openInNewTab={openInNewTab}
      details={
        <Fragment>
          {project && (
            <StyledProjectBadge
              css={css`
                && img {
                  box-shadow: none;
                }
              `}
              project={project}
              avatarSize={16}
              disableLink
            />
          )}
          <ErrorBoundary customComponent={null}>
            <Details detector={detector} />
          </ErrorBoundary>
        </Fragment>
      }
    />
  );
}

const StyledProjectBadge = styled(ProjectBadge)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const Separator = styled('span')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.tokens.border.secondary};
  border-radius: 1px;
`;

const DetailItemContent = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
