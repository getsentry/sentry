/* eslint-disable no-alert */
import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
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
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useUserFromId from 'sentry/utils/useUserFromId';
import AutomationHistoryList from 'sentry/views/automations/components/automationHistoryList';
import ConditionsPanel from 'sentry/views/automations/components/conditionsPanel';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useAutomationQuery} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationDetail() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const params = useParams<{automationId: string}>();

  const {
    data: automation,
    isPending,
    isError,
    refetch,
  } = useAutomationQuery(params.automationId);

  const {data: createdByUser} = useUserFromId({id: Number(automation?.createdBy)});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <SentryDocumentTitle title={automation.name} noSuffix>
      <BreadcrumbsProvider
        crumb={{
          label: t('Automations'),
          to: makeAutomationBasePathname(organization.slug),
        }}
      >
        <ActionsProvider actions={<Actions />}>
          <DetailLayout>
            <DetailLayout.Main>
              <Section title={t('History')}>
                <ErrorBoundary mini>
                  <AutomationHistoryList history={[]} />
                </ErrorBoundary>
              </Section>
              <Section title={t('Connected Monitors')}>
                <ErrorBoundary mini>
                  <ConnectedMonitorsList detectorIds={automation.detectorIds} />
                </ErrorBoundary>
              </Section>
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
              <Section title={t('Last Triggered')}>
                {automation.lastTriggered ? (
                  <Flex gap={space(1)}>
                    <TimeSince date={automation.lastTriggered} />
                    <Flex>
                      (<DateTime date={automation.lastTriggered} year timeZone />)
                    </Flex>
                  </Flex>
                ) : (
                  t('Never')
                )}
              </Section>
              <Section title={t('Environment')}>
                {automation.environment || t('All environments')}
              </Section>
              <Section title={t('Action Interval')}>
                {tct('Every [frequency]', {
                  frequency: getDuration((automation.config.frequency || 0) * 60),
                })}
              </Section>
              <Section title={t('Conditions')}>
                <ErrorBoundary mini>
                  <ConditionsPanel
                    triggers={automation.triggers}
                    actionFilters={automation.actionFilters}
                  />
                </ErrorBoundary>
              </Section>
              <Section title={t('Details')}>
                <ErrorBoundary mini>
                  <KeyValueTable>
                    <KeyValueTableRow
                      keyName={t('Date created')}
                      value={<DateTime date={automation.dateCreated} dateOnly year />}
                    />
                    <KeyValueTableRow
                      keyName={t('Created by')}
                      value={createdByUser?.name || createdByUser?.email || t('Unknown')}
                    />
                    <KeyValueTableRow
                      keyName={t('Last modified')}
                      value={<TimeSince date={automation.dateUpdated} />}
                    />
                  </KeyValueTable>
                </ErrorBoundary>
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
      <LinkButton to="edit" priority="primary" icon={<IconEdit />} size="sm">
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}
