import {Fragment, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {DateTime} from 'sentry/components/dateTime';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {defined} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUserFromId} from 'sentry/utils/useUserFromId';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomationHistoryList} from 'sentry/views/automations/components/automationHistoryList';
import {AutomationStatsChart} from 'sentry/views/automations/components/automationStatsChart';
import {ConditionsPanel} from 'sentry/views/automations/components/conditionsPanel';
import {ConnectedMonitorsList} from 'sentry/views/automations/components/connectedMonitorsList';
import {ConnectedProjectsList} from 'sentry/views/automations/components/connectedProjectsList';
import {DisabledAlert} from 'sentry/views/automations/components/disabledAlert';
import {useAutomationQuery, useUpdateAutomation} from 'sentry/views/automations/hooks';
import {getAutomationActionsWarning} from 'sentry/views/automations/hooks/utils';
import {
  makeAutomationBasePathname,
  makeAutomationEditPathname,
} from 'sentry/views/automations/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

function AutomationDetailContent({automation}: {automation: Automation}) {
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();
  const {selection} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;

  const warning = getAutomationActionsWarning(automation);
  const [monitorListCursor, setMonitorListCursor] = useState<string | undefined>(
    undefined
  );
  const breadcrumbs = (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Alerts'),
          to: makeAutomationBasePathname(organization.slug),
        },
        {label: automation.name},
      ]}
    />
  );

  const hasConnections = !!automation.detectorIds.length;

  return (
    <SentryDocumentTitle title={automation.name}>
      <DetailLayout>
        {hasPageFrameFeature ? (
          <Fragment>
            <TopBar.Slot name="title">{breadcrumbs}</TopBar.Slot>
            <AutomationFeedbackButton />
          </Fragment>
        ) : (
          <DetailLayout.Header>
            <DetailLayout.HeaderContent>
              {breadcrumbs}
              <DetailLayout.Title title={automation.name} />
            </DetailLayout.HeaderContent>
            <DetailLayout.Actions>
              <AutomationFeedbackButton />
              <Actions automation={automation} size="sm" />
            </DetailLayout.Actions>
          </DetailLayout.Header>
        )}
        <DetailLayout.Body>
          <DetailLayout.Main>
            <DisabledAlert automation={automation} />

            {automation.enabled && warning && (
              <Alert variant={warning.color === 'warning' ? 'warning' : 'danger'}>
                {warning.message}
              </Alert>
            )}

            {!hasConnections && (
              <Alert variant="warning">
                {t(
                  'This alert is not connected to a project or monitor and will not trigger.'
                )}
              </Alert>
            )}

            <PageFiltersContainer>
              {hasPageFrameFeature ? (
                <Flex align="center" justify="between" gap="md">
                  <DatePageFilter />
                  <Flex flex={1} justify="end" gap="md">
                    <Actions automation={automation} size="sm" />
                  </Flex>
                </Flex>
              ) : (
                <DatePageFilter />
              )}

              <ErrorBoundary>
                <AutomationStatsChart
                  automationId={automation.id}
                  period={period ?? ''}
                  start={start ?? null}
                  end={end ?? null}
                  utc={utc ?? null}
                />
              </ErrorBoundary>

              <DetailSection title={t('History')}>
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
              </DetailSection>

              <DetailSection
                title={t('Connected Projects')}
                description={t(
                  'All issues belonging to a connected project will trigger this alert when conditions are met.'
                )}
              >
                <ErrorBoundary mini>
                  <ConnectedProjectsList automationId={automation.id} />
                </ErrorBoundary>
              </DetailSection>

              <DetailSection
                title={t('Connected Monitors')}
                description={t(
                  'Issues created by a connected monitor will trigger this alert when conditions are met.'
                )}
              >
                <ErrorBoundary mini>
                  <ConnectedMonitorsList
                    workflowId={automation.id}
                    cursor={monitorListCursor}
                    onCursor={setMonitorListCursor}
                    query="!type:issue_stream"
                  />
                </ErrorBoundary>
              </DetailSection>
            </PageFiltersContainer>
          </DetailLayout.Main>

          <DetailLayout.Sidebar>
            <DetailSection title={t('Last Triggered')}>
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
            </DetailSection>
            <DetailSection title={t('Environment')}>
              {automation.environment || t('All environments')}
            </DetailSection>
            <DetailSection title={t('Throttling')}>
              {automation.config.frequency
                ? getDuration(automation.config.frequency * 60)
                : t('Notify on every trigger')}
            </DetailSection>
            <DetailSection title={t('Conditions')}>
              <ErrorBoundary mini>
                <ConditionsPanel
                  triggers={automation.triggers}
                  actionFilters={automation.actionFilters}
                />
              </ErrorBoundary>
            </DetailSection>
            <DetailSection title={t('Details')}>
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
            </DetailSection>
          </DetailLayout.Sidebar>
        </DetailLayout.Body>
      </DetailLayout>
    </SentryDocumentTitle>
  );
}

function AutomationDetailLoadingStates({automationId}: {automationId: string}) {
  const {
    data: automation,
    isPending,
    isError,
    error,
    refetch,
  } = useAutomationQuery(automationId);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={error.status === 404 ? t('The alert could not be found.') : undefined}
        onRetry={refetch}
      />
    );
  }

  return <AutomationDetailContent automation={automation} />;
}

export default function AutomationDetail() {
  const params = useParams<{automationId: string}>();

  const {data: automation, isPending} = useAutomationQuery(params.automationId);

  return (
    <VisuallyCompleteWithData
      id="AutomationDetails-Body"
      isLoading={isPending}
      hasData={defined(automation)}
    >
      <AutomationDetailLoadingStates automationId={params.automationId} />
    </VisuallyCompleteWithData>
  );
}

function Actions({automation, size}: {automation: Automation; size?: 'sm'}) {
  const organization = useOrganization();
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = () => {
    const newEnabled = !automation.enabled;
    updateAutomation(
      {
        id: automation.id,
        name: automation.name,
        enabled: newEnabled,
      },
      {
        onSuccess: () => {
          addSuccessMessage(newEnabled ? t('Alert enabled') : t('Alert disabled'));
        },
      }
    );
  };

  return (
    <Fragment>
      <Button variant="secondary" size={size} onClick={toggleDisabled} busy={isUpdating}>
        {automation.enabled ? t('Disable') : t('Enable')}
      </Button>
      <LinkButton
        to={makeAutomationEditPathname(organization.slug, automation.id)}
        variant="primary"
        icon={<IconEdit />}
        size={size}
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
    return '—';
  }
  if (isPending) {
    return <Placeholder height="20px" />;
  }
  return createdByUser?.name || createdByUser?.email || t('Unknown');
}
