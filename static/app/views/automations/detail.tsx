/* eslint-disable no-alert */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
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
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import AutomationHistoryList from 'sentry/views/automations/components/automationHistoryList';
import ConditionsPanel from 'sentry/views/automations/components/conditionsPanel';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';

function HistoryAndConnectedMonitors() {
  return (
    <div>
      <Section title={t('History')}>
        <AutomationHistoryList history={[]} />
      </Section>
      <Section title={t('Connected Monitors')}>
        <ConnectedMonitorsList monitors={[]} />
      </Section>
    </div>
  );
}

function Details() {
  return (
    <div>
      <Flex column gap={space(1)}>
        <SectionHeading>{t('Last Triggered')}</SectionHeading>
        <span>
          <TimeSince date={new Date()} />
        </span>
      </Flex>
      <Flex column gap={space(1)}>
        <SectionHeading>{t('Conditions')}</SectionHeading>
        <ConditionsPanel
          when_conditions={[
            t('An issue escalates'),
            t('A new event is captured for an issue'),
          ]}
          if_conditions={[
            t('Issue is assigned to no one'),
            t('Current issue priority is high'),
          ]}
          actions={[
            t(
              'Notify Suggested Assignees and if none can be found then notify Recently Active Members'
            ),
          ]}
        />
      </Flex>
      <Flex column gap={space(1)}>
        <SectionHeading>{t('Details')}</SectionHeading>
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
        </KeyValueTable>
      </Flex>
    </div>
  );
}

export default function AutomationDetail() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Automation')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Automations'), to: '/issues/automations'}}>
        <ActionsProvider actions={<Actions />}>
          <DetailLayout>
            <DetailLayout.Main>
              <HistoryAndConnectedMonitors />
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
              <Details />
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
        to="/issues/automations//edit"
        priority="primary"
        icon={<IconEdit />}
        size="sm"
      >
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}

export const SectionHeading = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;
