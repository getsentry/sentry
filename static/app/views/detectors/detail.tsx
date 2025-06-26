/* eslint-disable no-alert */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconArrow, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import DetailsPanel from 'sentry/views/detectors/components/detailsPanel';
import IssuesList from 'sentry/views/detectors/components/issuesList';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';

const DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL: Record<
  DetectorPriorityLevel,
  PriorityLevel
> = {
  [DetectorPriorityLevel.LOW]: PriorityLevel.LOW,
  [DetectorPriorityLevel.MEDIUM]: PriorityLevel.MEDIUM,
  [DetectorPriorityLevel.HIGH]: PriorityLevel.HIGH,
  [DetectorPriorityLevel.OK]: PriorityLevel.LOW,
};

function getDetectorEnvironment(detector: Detector) {
  return (
    detector.dataSources?.find(ds => ds.type === 'snuba_query_subscription')?.queryObj
      ?.snubaQuery.environment ?? t('All environments')
  );
}

function AssignToTeam({teamId}: {teamId: string}) {
  const {teams} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);
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

  return t('Assign to %s', user?.name ?? user?.email ?? t('Unknown user'));
}

function DetectorPriorities({detector}: {detector: Detector}) {
  const detectionType = detector.config?.detection_type || 'static';

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
    return <div>{t('No priority thresholds configured')}</div>;
  }

  const getConditionLabel = (condition: (typeof priorityConditions)[0]) => {
    const typeLabel =
      condition.type === DataConditionType.GREATER ? t('Above') : t('Below');

    // For static/percent detectors, comparison should be a simple number
    const comparisonValue =
      typeof condition.comparison === 'number'
        ? String(condition.comparison)
        : String(condition.comparison || '0');

    return `${typeLabel} ${comparisonValue}`;
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
                condition.conditionResult as DetectorPriorityLevel
              ]
            }
          />
        </Fragment>
      ))}
    </PrioritiesList>
  );
}

function DetectorResolve({detector}: {detector: Detector}) {
  const detectionType = detector.config?.detection_type || 'static';
  const conditions = detector.conditionGroup?.conditions || [];

  // Get the main condition (first non-OK condition)
  const mainCondition = conditions.find(
    condition => condition.conditionResult !== DetectorPriorityLevel.OK
  );

  const description = getResolutionDescription({
    detectionType,
    conditionType: mainCondition?.type ?? undefined,
    conditionValue: mainCondition?.comparison ?? undefined,
    comparisonDelta: (detector.config as any)?.comparison_delta ?? undefined,
    thresholdSuffix: undefined, // No suffix in detail view
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

  return <span>{user?.name ?? user?.email ?? t('Unknown')}</span>;
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

export default function DetectorDetails() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const params = useParams<{detectorId: string}>();
  const {projects} = useProjects();

  const {
    data: detector,
    isPending,
    isError,
    refetch,
  } = useDetectorQuery(params.detectorId);
  const project = projects.find(p => p.id === detector?.projectId);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !project) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <SentryDocumentTitle title={detector.name} noSuffix>
      <BreadcrumbsProvider
        crumb={{label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)}}
      >
        <ActionsProvider actions={<Actions detector={detector} />}>
          <DetailLayout project={project}>
            <DetailLayout.Main>
              {/* TODO: Add chart here */}
              <Section title={t('Ongoing Issues')}>
                {/* TODO: Replace with GroupList */}
                <IssuesList />
              </Section>
              <Section title={t('Connected Automations')}>
                <ErrorBoundary mini>
                  <ConnectedAutomationsList automationIds={detector.workflowIds} />
                </ErrorBoundary>
              </Section>
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
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
                <KeyValueTable>
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
                    value={getDetectorEnvironment(detector)}
                  />
                </KeyValueTable>
              </Section>
            </DetailLayout.Sidebar>
          </DetailLayout>
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

function Actions({detector}: {detector: Detector}) {
  const organization = useOrganization();
  const disable = () => {
    window.alert('disable');
  };
  return (
    <Fragment>
      <Button onClick={disable} size="sm">
        {t('Disable')}
      </Button>
      <LinkButton
        to={`${makeMonitorDetailsPathname(organization.slug, detector.id)}edit/`}
        priority="primary"
        icon={<IconEdit />}
        size="sm"
      >
        {t('Edit')}
      </LinkButton>
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
