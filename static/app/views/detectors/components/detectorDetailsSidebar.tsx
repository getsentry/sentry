import {Fragment} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';
import DetailsPanel from 'sentry/views/detectors/components/detailsPanel';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

function getDetectorEnvironment(detector: Detector) {
  // TODO: Add support for other detector types
  if (detector.type !== 'metric_issue') {
    return '<placeholder>';
  }

  return (
    detector.dataSources?.find(ds => ds.type === 'snuba_query_subscription')?.queryObj
      ?.snubaQuery.environment ?? t('All environments')
  );
}

function AssignToTeam({teamId}: {teamId: string}) {
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);

  if (isLoading) {
    return (
      <Flex align="center" gap={space(0.5)}>
        {t('Assign to')} <Placeholder width="80px" height="16px" />
      </Flex>
    );
  }

  return t('Assign to %s', `#${team?.slug ?? 'unknown'}`);
}

function AssignToUser({userId}: {userId: string}) {
  const {isPending, data: user} = useUserFromId({id: parseInt(userId, 10)});

  if (isPending) {
    return (
      <Flex align="center" gap={space(0.5)}>
        {t('Assign to')} <Placeholder width="80px" height="16px" />
      </Flex>
    );
  }

  const title = user?.name ?? user?.email ?? t('Unknown user');
  return (
    <Tooltip title={title} showOnlyOnOverflow>
      {t('Assign to %s', title)}
    </Tooltip>
  );
}

function DetectorPriorities({detector}: {detector: Detector}) {
  if (detector.type !== 'metric_issue') {
    return null;
  }

  // TODO: Add support for other detector types
  if (!('detectionType' in detector.config)) {
    return null;
  }

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

function DetectorResolve({detector}: {detector: Detector}) {
  // TODO: Add support for other detector types
  if (detector.type !== 'metric_issue') {
    return null;
  }

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

function DetectorCreatedBy({createdBy}: {createdBy: Detector['createdBy']}) {
  const {isPending, data: user} = useUserFromId({
    id: createdBy ? parseInt(createdBy, 10) : undefined,
  });

  if (!createdBy) {
    return t('Sentry');
  }

  if (isPending) {
    return <Placeholder width="80px" height="16px" />;
  }

  const title = user?.name ?? user?.email ?? t('Unknown');
  return (
    <Tooltip title={title} showOnlyOnOverflow>
      <TextOverflow>{title}</TextOverflow>
    </Tooltip>
  );
}

function DetectorAssignee({owner}: {owner: string | null}) {
  if (!owner) {
    return t('Unassigned');
  }

  const [ownerType, ownerId] = owner.split(':');
  if (ownerType === 'team') {
    return <AssignToTeam teamId={ownerId!} />;
  }
  if (ownerType === 'user') {
    return <AssignToUser userId={ownerId!} />;
  }

  return t('Unassigned');
}

interface DetectorDetailsSidebarProps {
  detector: Detector;
}

export function DetectorDetailsSidebar({detector}: DetectorDetailsSidebarProps) {
  return (
    <Fragment>
      <Section title={t('Detect')}>
        <DetailsPanel detector={detector} />
      </Section>
      <Section title={t('Assign')}>
        <DetectorAssignee owner={detector.owner} />
      </Section>
      <Section title={t('Prioritize')}>
        <DetectorPriorities detector={detector} />
      </Section>
      <Section title={t('Resolve')}>
        <DetectorResolve detector={detector} />
      </Section>
      <Section title={t('Details')}>
        <StyledKeyValueTable>
          <KeyValueTableRow
            keyName={t('Date created')}
            value={<DateTime date={detector.dateCreated} dateOnly year />}
          />
          <KeyValueTableRow
            keyName={t('Created by')}
            value={<DetectorCreatedBy createdBy={detector.createdBy ?? null} />}
          />
          <KeyValueTableRow
            keyName={t('Last modified')}
            value={<TimeSince date={detector.dateUpdated} />}
          />
          <KeyValueTableRow
            keyName={t('Environment')}
            value={
              <Tooltip title={getDetectorEnvironment(detector)} showOnlyOnOverflow>
                <TextOverflow>{getDetectorEnvironment(detector)}</TextOverflow>
              </Tooltip>
            }
          />
        </StyledKeyValueTable>
      </Section>
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

const StyledKeyValueTable = styled(KeyValueTable)`
  grid-template-columns: min-content auto;
`;
