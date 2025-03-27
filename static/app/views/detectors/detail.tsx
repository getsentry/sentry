/* eslint-disable no-alert */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/core/button';
import {DateTime} from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
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

export default function DetectorDetail() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={'/endpoint'} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Monitors'), to: '/issues/monitors'}}>
        <ActionsProvider actions={<Actions />}>
          <DetailLayout project={{slug: 'project-slug', platform: 'javascript-astro'}}>
            <DetailLayout.Main>
              {/* TODO: Add chart here */}
              <Section title={t('Ongoing Issues')}>
                {/* TODO: Replace with GroupList */}
                <IssuesList />
              </Section>
              <Section title={t('Connected Automations')}>
                <ConnectedAutomationsList />
              </Section>
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
              <Section title={t('Detect')}>
                <DetailsPanel />
              </Section>
              <Section title={t('Assign')}>
                {t('Assign to %s', 'admin@sentry.io')}
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
                    value={<DateTime date={new Date()} dateOnly year />}
                  />
                  <KeyValueTableRow keyName={t('Created by')} value="Jane Doe" />
                  <KeyValueTableRow
                    keyName={t('Last modified')}
                    value={<TimeSince date={new Date()} />}
                  />
                  <KeyValueTableRow keyName={t('Team')} value="Platform" />
                  <KeyValueTableRow keyName={t('Environment')} value="prod" />
                </KeyValueTable>
              </Section>
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
      <Button onClick={disable} size="sm">
        {t('Disable')}
      </Button>
      <LinkButton
        to="/issues/monitors/edit"
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
