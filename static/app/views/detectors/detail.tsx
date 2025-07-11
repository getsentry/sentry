/* eslint-disable no-alert */
import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import {DetectorDetailsSidebar} from 'sentry/views/detectors/components/detectorDetailsSidebar';
import IssuesList from 'sentry/views/detectors/components/issuesList';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

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
      <DetailLayout>
        <DetailLayout.Header>
          <DetailLayout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {label: detector.name},
              ]}
            />
            <DetailLayout.Title title={detector.name} project={project} />
          </DetailLayout.HeaderContent>
          <DetailLayout.Actions>
            <Actions detector={detector} />
          </DetailLayout.Actions>
        </DetailLayout.Header>
        <DetailLayout.Body>
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
            <DetectorDetailsSidebar detector={detector} />
          </DetailLayout.Sidebar>
        </DetailLayout.Body>
      </DetailLayout>
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
