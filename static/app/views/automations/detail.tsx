import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {getUtcDateString} from 'sentry/utils/dates';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useUserFromId from 'sentry/utils/useUserFromId';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import AutomationHistoryList from 'sentry/views/automations/components/automationHistoryList';
import {AutomationStatsChart} from 'sentry/views/automations/components/automationStatsChart';
import ConditionsPanel from 'sentry/views/automations/components/conditionsPanel';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useAutomationQuery, useUpdateAutomation} from 'sentry/views/automations/hooks';
import {getAutomationActionsWarning} from 'sentry/views/automations/hooks/utils';
import {
  makeAutomationBasePathname,
  makeAutomationEditPathname,
} from 'sentry/views/automations/pathnames';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

const AUTOMATION_DETECTORS_LIMIT = 10;

function AutomationDetailContent({automation}: {automation: Automation}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

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

  const {selection} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;

  const warning = getAutomationActionsWarning(automation);

  return (
    <SentryDocumentTitle title={automation.name}>
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
            {warning && (
              <Alert type={warning.color === 'warning' ? 'warning' : 'error'}>
                {warning.message}
              </Alert>
            )}
            <PageFiltersContainer>
              <DatePageFilter />
              <ErrorBoundary>
                <AutomationStatsChart
                  automationId={automation.id}
                  period={period ?? ''}
                  start={start ?? null}
                  end={end ?? null}
                  utc={utc ?? null}
                />
              </ErrorBoundary>
              <Section title={t('History')}>
                <ErrorBoundary mini>
                  <AutomationHistoryList
                    automationId={automation.id}
                    query={{
                      ...(period && {statsPeriod: period}),
                      start: start ? getUtcDateString(start) : undefined,
                      end: end ? getUtcDateString(end) : undefined,
                      utc: utc ? 'true' : undefined,
                    }}
                  />
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
                  <StyledPagination
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
            </PageFiltersContainer>
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
                    value={<UserDisplayName id={automation.createdBy} />}
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
  const organization = useOrganization();
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = useCallback(() => {
    const newEnabled = !automation.enabled;
    updateAutomation(
      {
        id: automation.id,
        name: automation.name,
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
      <AutomationFeedbackButton />
      <Button priority="default" size="sm" onClick={toggleDisabled} busy={isUpdating}>
        {automation.enabled ? t('Disable') : t('Enable')}
      </Button>
      <LinkButton
        to={makeAutomationEditPathname(organization.slug, automation.id)}
        priority="primary"
        icon={<IconEdit />}
        size="sm"
      >
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}

function UserDisplayName({id}: {id: string | undefined}) {
  const {data: createdByUser, isPending} = useUserFromId({
    id: id ? Number(id) : undefined,
  });
  if (!id) {
    return t('Sentry');
  }
  if (isPending) {
    return <Placeholder height="20px" />;
  }
  return createdByUser?.name || createdByUser?.email || t('Unknown');
}

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
