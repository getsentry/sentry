import {Fragment} from 'react';
import {Link} from 'react-router-dom';

import {Tooltip} from 'sentry/components/core/tooltip';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsDescription} from 'sentry/views/detectors/components/details/common/description';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {MetricDetectorDetailsDetect} from 'sentry/views/detectors/components/details/metric/detect';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

interface DetectorDetailsSidebarProps {
  detector: MetricDetector;
}

function DetectorResolve({detector}: {detector: MetricDetector}) {
  const detectionType = detector.config?.detectionType || 'static';
  const conditions = detector.conditionGroup?.conditions || [];

  // Get the main condition (first non-OK condition)
  const mainCondition = conditions.find(
    condition => condition.conditionResult !== DetectorPriorityLevel.OK
  );

  // Get the OK condition (resolution condition)
  const okCondition = conditions.find(
    condition => condition.conditionResult === DetectorPriorityLevel.OK
  );

  const thresholdSuffix = getMetricDetectorSuffix(
    detector.config?.detectionType || 'static',
    detector.dataSources[0].queryObj?.snubaQuery?.aggregate || 'count()'
  );

  const description = getResolutionDescription({
    detectionType,
    conditionType: mainCondition?.type,
    highThreshold:
      typeof mainCondition?.comparison === 'number'
        ? mainCondition.comparison
        : undefined,
    resolutionThreshold:
      typeof okCondition?.comparison === 'number' ? okCondition.comparison : undefined,
    comparisonDelta: (detector.config as any)?.comparison_delta,
    thresholdSuffix,
  });

  return <div>{description}</div>;
}

function GoToMetricAlert({detector}: {detector: MetricDetector}) {
  const organization = useOrganization();
  const user = useUser();
  if (!user.isSuperuser || !detector.alertRuleId) {
    return null;
  }

  return (
    <div>
      <Tooltip title="Superuser only" skipWrapper>
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}/issues/alerts/rules/details/${detector.alertRuleId}/`
          )}
        >
          View Metric Alert
        </Link>
      </Tooltip>
    </div>
  );
}

export function MetricDetectorDetailsSidebar({detector}: DetectorDetailsSidebarProps) {
  return (
    <Fragment>
      <Section title={t('Detect')}>
        <MetricDetectorDetailsDetect detector={detector} />
      </Section>
      <DetectorDetailsAssignee owner={detector.owner} />
      <Section title={t('Resolve')}>
        <DetectorResolve detector={detector} />
      </Section>
      <DetectorDetailsDescription description={detector.description} />
      <DetectorExtraDetails>
        <DetectorExtraDetails.DateCreated detector={detector} />
        <DetectorExtraDetails.CreatedBy detector={detector} />
        <DetectorExtraDetails.LastModified detector={detector} />
        <DetectorExtraDetails.Environment detector={detector} />
      </DetectorExtraDetails>
      <GoToMetricAlert detector={detector} />
    </Fragment>
  );
}
