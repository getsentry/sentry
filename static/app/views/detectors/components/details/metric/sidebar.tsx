import {Fragment} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {MetricDetectorDetailsDetect} from 'sentry/views/detectors/components/details/metric/detect';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

interface DetectorDetailsSidebarProps {
  detector: MetricDetector;
}

function DetectorPriorities({detector}: {detector: MetricDetector}) {
  const detectionType = detector.config?.detectionType || 'static';

  // For dynamic detectors, show the automatic priority message
  if (detectionType === 'dynamic') {
    return <div>{t('Sentry will automatically update priority.')}</div>;
  }

  const conditions = detector.conditionGroup?.conditions || [];

  // Filter out OK conditions and sort by priority level
  const priorityConditions = conditions
    .filter(condition => condition.conditionResult !== DetectorPriorityLevel.OK)
    .sort((a, b) => (a.conditionResult || 0) - (b.conditionResult || 0));

  if (priorityConditions.length === 0) {
    return null;
  }

  const getConditionLabel = (condition: (typeof priorityConditions)[0]) => {
    const typeLabel =
      condition.type === DataConditionType.GREATER ? t('Above') : t('Below');

    // For static/percent detectors, comparison should be a simple number
    const comparisonValue =
      typeof condition.comparison === 'number'
        ? String(condition.comparison)
        : String(condition.comparison || '0');
    const thresholdSuffix = getMetricDetectorSuffix(detector);

    return `${typeLabel} ${comparisonValue}${thresholdSuffix}`;
  };

  return (
    <PrioritiesList>
      {priorityConditions.map((condition, index) => (
        <Fragment key={index}>
          <PriorityCondition>{getConditionLabel(condition)}</PriorityCondition>
          <IconArrow direction="right" />
          <GroupPriorityBadge
            showLabel
            priority={
              DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[
                condition.conditionResult as keyof typeof DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL
              ]
            }
          />
        </Fragment>
      ))}
    </PrioritiesList>
  );
}

function DetectorResolve({detector}: {detector: MetricDetector}) {
  const detectionType = detector.config?.detectionType || 'static';
  const conditions = detector.conditionGroup?.conditions || [];

  // Get the main condition (first non-OK condition)
  const mainCondition = conditions.find(
    condition => condition.conditionResult !== DetectorPriorityLevel.OK
  );
  const thresholdSuffix = getMetricDetectorSuffix(detector);

  const description = getResolutionDescription({
    detectionType,
    conditionType: mainCondition?.type,
    conditionValue: mainCondition?.comparison,
    comparisonDelta: (detector.config as any)?.comparison_delta,
    thresholdSuffix,
  });

  return <div>{description}</div>;
}

export function MetricDetectorDetailsSidebar({detector}: DetectorDetailsSidebarProps) {
  return (
    <Fragment>
      <Section title={t('Detect')}>
        <MetricDetectorDetailsDetect detector={detector} />
      </Section>
      <DetectorDetailsAssignee owner={detector.owner} />
      <Section title={t('Prioritize')}>
        <DetectorPriorities detector={detector} />
      </Section>
      <Section title={t('Resolve')}>
        <DetectorResolve detector={detector} />
      </Section>
      <DetectorExtraDetails>
        <DetectorExtraDetails.DateCreated detector={detector} />
        <DetectorExtraDetails.CreatedBy detector={detector} />
        <DetectorExtraDetails.LastModified detector={detector} />
        <DetectorExtraDetails.Environment detector={detector} />
      </DetectorExtraDetails>
    </Fragment>
  );
}

const PrioritiesList = styled('div')`
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  width: fit-content;
  gap: ${space(0.5)} ${space(1)};

  p {
    margin: 0;
    width: fit-content;
  }
`;

const PriorityCondition = styled('div')`
  justify-self: flex-end;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;
