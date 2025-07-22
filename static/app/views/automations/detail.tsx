import {Fragment, useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useUserFromId from 'sentry/utils/useUserFromId';
import AutomationHistoryList from 'sentry/views/automations/components/automationHistoryList';
import ConditionsPanel from 'sentry/views/automations/components/conditionsPanel';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useAutomationQuery, useUpdateAutomation} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

const AUTOMATION_DETECTORS_LIMIT = 10;

function AutomationDetailContent({automation}: {automation: Automation}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const {data: createdByUser} = useUserFromId({id: Number(automation.createdBy)});

  const {
    data: detectors,
    isLoading,
    isError,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      ids: automation.detectorIds,
      limit: AUTOMATION_DETECTORS_LIMIT,
      cursor: location.query.cursor as string | undefined,
    },
    {
      enabled: automation.detectorIds.length > 0,
    }
  );

  return (
    <SentryDocumentTitle title={automation.name} noSuffix>
      <DetailLayout>
        <DetailLayout.Header>
          <DetailLayout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Automations'),
                  to: makeAutomationBasePathname(organization.slug),
                },
                {label: automation.name},
              ]}
            />
            <DetailLayout.Title title={automation.name} />
          </DetailLayout.HeaderContent>
          <DetailLayout.Actions>
            <Actions automation={automation} />
          </DetailLayout.Actions>
        </DetailLayout.Header>
        <DetailLayout.Body>
          <DetailLayout.Main>
            <Section title={t('History')}>
              <ErrorBoundary mini>
                <AutomationHistoryList automationId={automation.id} />
              </ErrorBoundary>
            </Section>
            <Section title={t('Connected Monitors')}>
              <ErrorBoundary mini>
                <ConnectedMonitorsList
                  detectors={detectors ?? []}
                  isLoading={isLoading}
                  isError={isError}
                  connectedDetectorIds={automation.detectorIds}
                  numSkeletons={Math.min(
                    automation.detectorIds.length,
                    AUTOMATION_DETECTORS_LIMIT
                  )}
                />
                <Pagination
                  pageLinks={getResponseHeader?.('Link')}
                  onCursor={cursor => {
                    navigate({
                      pathname: location.pathname,
                      query: {...location.query, cursor},
                    });
                  }}
                />
              </ErrorBoundary>
            </Section>
          </DetailLayout.Main>
          <DetailLayout.Sidebar>
            <Section title={t('Last Triggered')}>
              {automation.lastTriggered ? (
                <Flex gap="md">
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
        </DetailLayout.Body>
      </DetailLayout>
    </SentryDocumentTitle>
  );
}

export default function AutomationDetail() {
  useWorkflowEngineFeatureGate({redirect: true});
  const params = useParams<{automationId: string}>();

  const {
    data: automation,
    isPending,
    isError,
    refetch,
  } = useAutomationQuery(params.automationId);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return <AutomationDetailContent automation={automation} />;
}

function Actions({automation}: {automation: Automation}) {
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = useCallback(() => {
    const newEnabled = !automation.enabled;
    updateAutomation(
      {
        automationId: automation.id,
        ...automation,
        enabled: newEnabled,
      },
      {
        onSuccess: () => {
          addSuccessMessage(
            newEnabled ? t('Automation enabled') : t('Automation disabled')
          );
        },
      }
    );
  }, [updateAutomation, automation]);

  return (
    <Fragment>
      <Button priority="default" size="sm" onClick={toggleDisabled} busy={isUpdating}>
        {automation.enabled ? t('Disable') : t('Enable')}
      </Button>
      <LinkButton to="edit" priority="primary" icon={<IconEdit />} size="sm">
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}
