/* eslint-disable no-alert */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import DetailsPanel from 'sentry/views/detectors/components/detailsPanel';
import IssuesList from 'sentry/views/detectors/components/issuesList';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

type Priority = {
  sensitivity: string;
  threshold: number;
};

const priorities: Priority[] = [
  {sensitivity: 'medium', threshold: 4},
  {sensitivity: 'high', threshold: 10},
];

function getDetectorEnvironment(detector: Detector) {
  return detector.dataSources?.find(ds => ds.type === 'snuba_query_subscription')
    ?.queryObj?.snubaQuery.environment;
}

function AssignToTeam({teamId}: {teamId: string}) {
  const {teams} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);
  return t('Assign to %s', `#${team?.slug ?? 'unknown'}`);
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
    return t(
      'Assign to %s',
      <ActorBadge actor={{id: ownerId!, name: '', type: 'user'}} />
    );
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
                <PrioritiesList>
                  {priorities.map(priority => (
                    <Fragment key={priority.sensitivity}>
                      <PriorityDuration>
                        {getDuration(priority.threshold, 0, false, true)}
                      </PriorityDuration>
                      <IconArrow direction="right" />
                      <p>{priority.sensitivity}</p>
                    </Fragment>
                  ))}
                </PrioritiesList>
              </Section>
              <Section title={t('Resolve')}>
                {t('Auto-resolve after %s of inactivity', getDuration(3000000))}
              </Section>
              <Section title={t('Details')}>
                <KeyValueTable>
                  <KeyValueTableRow
                    keyName={t('Date created')}
                    value={<DateTime date={detector.dateCreated} dateOnly year />}
                  />
                  <KeyValueTableRow keyName={t('Created by')} value="placeholder" />
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
  grid-template-rows: repeat(${priorities.length}, 1fr);
  align-items: center;
  width: fit-content;
  gap: ${space(0.5)} ${space(1)};

  p {
    margin: 0;
    width: fit-content;
  }
`;

const PriorityDuration = styled('p')`
  justify-self: flex-end;
`;
