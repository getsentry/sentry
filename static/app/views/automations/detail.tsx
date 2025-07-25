/* eslint-disable no-alert */
import {Fragment} from 'react';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {type ChangeData, TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useUserFromId from 'sentry/utils/useUserFromId';
import AutomationHistoryList from 'sentry/views/automations/components/automationHistoryList';
import {AutomationStatsChart} from 'sentry/views/automations/components/automationStatsChart';
import ConditionsPanel from 'sentry/views/automations/components/conditionsPanel';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useAutomationQuery} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

const AUTOMATION_DETECTORS_LIMIT = 10;

const DEFAULT_CHART_PERIOD = '7d';

const PAGE_QUERY_PARAMS = [
  'pageStatsPeriod',
  'pageStart',
  'pageEnd',
  'pageUtc',
  'cursor',
];

function getDateTimeFromQuery(query: Record<string, any>): DateTimeObject {
  const {
    start,
    end,
    statsPeriod,
    utc: utcString,
  } = normalizeDateTimeParams(query, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
    defaultStatsPeriod: DEFAULT_CHART_PERIOD,
  });

  const utc = utcString === 'true';

  // Following getParams, statsPeriod will take priority over start/end
  if (!statsPeriod && start && end) {
    return utc
      ? {
          start: moment.utc(start).format(),
          end: moment.utc(end).format(),
          utc,
        }
      : {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
          utc,
        };
  }

  return {period: statsPeriod};
}

function AutomationDetailContent({automation}: {automation: Automation}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const {data: createdByUser} = useUserFromId({id: Number(automation.createdBy)});

  function setStateOnUrl(nextState: {
    cursor?: string;
    pageEnd?: DateString;
    pageStart?: DateString;
    pageStatsPeriod?: string | null;
    pageUtc?: boolean | null;
    team?: string;
  }) {
    return navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...pick(nextState, PAGE_QUERY_PARAMS),
      },
    });
  }

  function handleUpdateDatetime(datetime: ChangeData) {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      return setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc ?? undefined,
        cursor: undefined,
      });
    }

    return setStateOnUrl({
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
      cursor: undefined,
    });
  }

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

  const {period, start, end, utc} = getDateTimeFromQuery(location?.query ?? {});

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
            <Actions />
          </DetailLayout.Actions>
        </DetailLayout.Header>
        <DetailLayout.Body>
          <DetailLayout.Main>
            <TimeRangeSelector
              relative={period ?? ''}
              start={start ?? null}
              end={end ?? null}
              utc={utc ?? null}
              onChange={handleUpdateDatetime}
            />
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
                    start,
                    end,
                    utc,
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
