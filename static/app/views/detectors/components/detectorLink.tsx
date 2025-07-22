import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {t} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  Detector,
  MetricDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import getDuration from 'sentry/utils/duration/getDuration';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {unreachable} from 'sentry/utils/unreachable';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

type DetectorLinkProps = {
  detector: Detector;
  className?: string;
};

function formatConditionType(condition: DataCondition) {
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
  const type = detector.config.detectionType;
  const conditions = detector.conditionGroup?.conditions;
  if (!conditions?.length) {
    return null;
  }

  const unit = getMetricDetectorSuffix(detector);
  switch (type) {
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
      unreachable(type);
      return null;
  }
}

function MetricDetectorDetails({detector}: {detector: MetricDetector}) {
  return (
    <Fragment>
      {detector.dataSources.map(dataSource => {
        if (!dataSource.queryObj) {
          return null;
        }
        return (
          <Fragment key={dataSource.id}>
            <DetailItem>{dataSource.queryObj.snubaQuery.environment}</DetailItem>
            <DetailItem>{dataSource.queryObj.snubaQuery.aggregate}</DetailItem>
            <DetailItem>
              {middleEllipsis(dataSource.queryObj.snubaQuery.query, 40)}
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
            <DetailItem>{getDuration(dataSource.queryObj.intervalSeconds)}</DetailItem>
          </Fragment>
        );
      })}
    </Fragment>
  );
}

function Details({detector}: {detector: Detector}) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return <MetricDetectorDetails detector={detector} />;
    case 'uptime_domain_failure':
      return <UptimeDetectorDetails detector={detector} />;
    // TODO: Implement details for Cron detectors
    case 'uptime_subscription':
    case 'error':
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}

export function DetectorLink({detector, className}: DetectorLinkProps) {
  const org = useOrganization();
  const project = useProjectFromId({project_id: detector.projectId});

  return (
    <TitleCell
      className={className}
      name={detector.name}
      link={makeMonitorDetailsPathname(org.slug, detector.id)}
      systemCreated={!detector.createdBy}
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
          <Details detector={detector} />
        </Fragment>
      }
    />
  );
}

const StyledProjectBadge = styled(ProjectBadge)`
  color: ${p => p.theme.subText};
`;

const Separator = styled('span')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
  border-radius: 1px;
`;

const DetailItemContent = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
