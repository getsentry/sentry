/* eslint-disable no-alert */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconArrow, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import DetailsPanel from 'sentry/views/detectors/components/detailsPanel';
import IssuesList from 'sentry/views/detectors/components/issuesList';

type Priority = {
  sensitivity: string;
  threshold: number;
};

const priorities: Priority[] = [
  {sensitivity: 'medium', threshold: 4},
  {sensitivity: 'high', threshold: 10},
];

const assignee = 'admin@sentry.io';

const resolve_threshold = 2600000;

export default function DetectorDetail() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={'/endpoint'} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Monitors'), to: '/monitors'}}>
        <ActionsProvider actions={<Actions />}>
          <DetailLayout project={{slug: 'project-slug', platform: 'javascript-astro'}}>
            <DetailLayout.Main>
              {/* TODO: Add chart here */}
              <Flex column gap={space(1)}>
                <strong>{t('Ongoing Issues')}</strong>
                <IssuesList />
              </Flex>
              <Flex column gap={space(1)}>
                <strong>{t('Connected Automations')}</strong>
                <ConnectedAutomationsList />
              </Flex>
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
              <Flex column gap={space(0.75)}>
                <strong>{t('Detect')}</strong>
                <DetailsPanel />
              </Flex>
              <Flex column gap={space(0.75)}>
                <strong>{t('Assign')}</strong>
                {t('Assign to %s', assignee)}
              </Flex>
              <Flex column gap={space(0.75)}>
                <strong>{t('Prioritize')}</strong>
                <PrioritiesList>
                  {priorities.map(priority => (
                    <Fragment key={priority.sensitivity}>
                      <p>{getDuration(priority.threshold, 0, false, true)}</p>
                      <IconArrow direction="right" />
                      <p>{priority.sensitivity}</p>
                    </Fragment>
                  ))}
                </PrioritiesList>
              </Flex>
              <Flex column gap={space(0.75)}>
                <strong>{t('Resolve')}</strong>
                {t('Auto-resolve after %s of inactivity', getDuration(resolve_threshold))}
              </Flex>
            </DetailLayout.Sidebar>
          </DetailLayout>
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  const disable = () => {
    window.alert('disable');
  };
  return (
    <Fragment>
      <Button onClick={disable}>{t('Disable')}</Button>
      <LinkButton to="/monitors/edit" priority="primary" icon={<IconEdit />}>
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}

const PrioritiesList = styled('div')`
  display: grid;
  grid-template-columns: auto auto auto;
  grid-template-rows: repeat(${priorities.length}, 1fr);
  gap: ${space(0.5)};
  width: auto;

  p {
    margin: 0;
    width: fit-content;
  }
`;
