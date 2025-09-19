import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Layout from 'sentry/components/layouts/thirds';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {IconClose} from 'sentry/icons';
import {t, tct, tctCode} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import AnomalyDetectionFeedbackBanner from 'sentry/views/alerts/rules/metric/details/anomalyDetectionFeedbackBanner';
import {ErrorMigrationWarning} from 'sentry/views/alerts/rules/metric/details/errorMigrationWarning';
import MetricHistory from 'sentry/views/alerts/rules/metric/details/metricHistory';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleComparisonType,
  Dataset,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {UserSnoozeDeprecationBanner} from 'sentry/views/alerts/rules/userSnoozeDeprecationBanner';
import type {Anomaly, Incident} from 'sentry/views/alerts/types';
import {AlertRuleStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';
import {DEPRECATED_TRANSACTION_ALERTS} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import type {TimePeriodType} from './constants';
import {SELECTOR_RELATIVE_PERIODS} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';
import {MetricDetailsSidebar} from './sidebar';
import {getFilter, getPeriodInterval} from './utils';

interface MetricDetailsBodyProps {
  timePeriod: TimePeriodType;
  anomalies?: Anomaly[];
  incidents?: Incident[];
  project?: Project;
  rule?: MetricRule;
  selectedIncident?: Incident | null;
}

export default function MetricDetailsBody({
  project,
  rule,
  incidents,
  timePeriod,
  selectedIncident,
  anomalies,
}: MetricDetailsBodyProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTransactionsDeprecationAlert, setShowTransactionsDeprecationAlert] =
    useState(
      organization.features.includes('performance-transaction-deprecation-banner')
    );

  const handleTimePeriodChange = (datetime: ChangeData) => {
    const {start, end, relative} = datetime;

    if (start && end) {
      return navigate({
        ...location,
        query: {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
        },
      });
    }

    return navigate({
      ...location,
      query: {
        period: relative,
      },
    });
  };

  if (!rule || !project) {
    return (
      <Layout.Body>
        <Layout.Main>
          <Placeholder height="38px" />
          <ChartPanel>
            <PanelBody withPadding>
              <Placeholder height="200px" />
            </PanelBody>
          </ChartPanel>
        </Layout.Main>
        <Layout.Side>
          <Placeholder height="200px" />
        </Layout.Side>
      </Layout.Body>
    );
  }

  const {dataset, aggregate, query} = rule;

  const eventType = extractEventTypeFilterFromRule(rule);
  const queryWithTypeFilter =
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM
      ? query
      : (query ? `(${query}) AND (${eventType})` : eventType).trim();
  const relativeOptions = {
    ...SELECTOR_RELATIVE_PERIODS,
    ...(rule.timeWindow > 1 ? {[TimePeriod.FOURTEEN_DAYS]: t('Last 14 days')} : {}),
    ...(rule.detectionType === AlertRuleComparisonType.DYNAMIC
      ? {[TimePeriod.TWENTY_EIGHT_DAYS]: t('Last 28 days')}
      : {}),
  };

  const showOnDemandMetricAlertUI =
    isOnDemandMetricAlert(dataset, aggregate, query) &&
    shouldShowOnDemandMetricAlertUI(organization);

  const formattedAggregate = aggregate;

  const ruleType =
    rule &&
    getAlertTypeFromAggregateDataset({
      aggregate: rule.aggregate,
      dataset: rule.dataset,
      eventTypes: rule.eventTypes,
      organization,
    });

  const deprecateTransactionsAlertsWarning =
    ruleType && DEPRECATED_TRANSACTION_ALERTS.includes(ruleType);

  return (
    <Fragment>
      {selectedIncident?.alertRule.status === AlertRuleStatus.SNAPSHOT && (
        <StyledLayoutBody>
          <Alert type="warning">
            {t('Alert Rule settings have been updated since this alert was triggered.')}
          </Alert>
        </StyledLayoutBody>
      )}
      <Layout.Body>
        <Layout.Main>
          {rule.snooze && (
            <Alert.Container>
              {rule.snoozeForEveryone ? (
                <Alert type="info">
                  {tct(
                    "[creator] muted this alert for everyone so you won't get these notifications in the future.",
                    {
                      creator: rule.snoozeCreatedBy,
                    }
                  )}
                </Alert>
              ) : (
                <UserSnoozeDeprecationBanner projectId={project.id} />
              )}
            </Alert.Container>
          )}
          {deprecateTransactionsAlertsWarning && showTransactionsDeprecationAlert && (
            <Alert.Container>
              <Alert
                type="warning"
                trailingItems={
                  <StyledCloseButton
                    icon={<IconClose size="sm" />}
                    aria-label={t('Close')}
                    onClick={() => {
                      setShowTransactionsDeprecationAlert(false);
                    }}
                    size="zero"
                    borderless
                  />
                }
              >
                {tctCode(
                  'The transaction dataset is being deprecated. Please use Span alerts instead. Spans are a superset of transactions, you can isolate transactions by using the [code:is_transaction:true] filter. Please read these [FAQLink:FAQs] for more information.',
                  {
                    FAQLink: (
                      <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40366087871515-FAQ-Transactions-Spans-Migration" />
                    ),
                  }
                )}
              </Alert>
            </Alert.Container>
          )}
          <StyledSubHeader>
            <StyledTimeRangeSelector
              relative={timePeriod.period ?? ''}
              start={(timePeriod.custom && timePeriod.start) || null}
              end={(timePeriod.custom && timePeriod.end) || null}
              onChange={handleTimePeriodChange}
              relativeOptions={relativeOptions}
              showAbsolute={false}
              disallowArbitraryRelativeRanges
              triggerLabel={
                timePeriod.custom
                  ? timePeriod.label
                  : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    relativeOptions[timePeriod.period ?? '']
              }
            />
            {selectedIncident && (
              <Tooltip
                title={`Click to clear filters`}
                isHoverable
                containerDisplayMode="inline-flex"
              >
                <Link
                  to={{
                    pathname: alertDetailsLink(organization, selectedIncident),
                  }}
                >
                  Remove filter on alert #{selectedIncident.identifier}
                </Link>
              </Tooltip>
            )}
          </StyledSubHeader>

          {selectedIncident?.alertRule.detectionType ===
            AlertRuleComparisonType.DYNAMIC && (
            <AnomalyDetectionFeedbackBanner
              // unique key to force re-render when incident changes
              key={selectedIncident.id}
              id={selectedIncident.id}
              organization={organization}
              selectedIncident={selectedIncident}
            />
          )}

          <ErrorMigrationWarning project={project} rule={rule} />
          <MetricChart
            rule={rule}
            incidents={incidents}
            anomalies={anomalies}
            timePeriod={timePeriod}
            formattedAggregate={formattedAggregate}
            project={project}
            interval={getPeriodInterval(timePeriod, rule)}
            query={isCrashFreeAlert(dataset) ? query : queryWithTypeFilter}
            filter={getFilter(rule)}
            isOnDemandAlert={isOnDemandMetricAlert(dataset, aggregate, query)}
            theme={theme}
          />
          <DetailWrapper>
            <ActivityWrapper>
              <MetricHistory incidents={incidents} />
              {[Dataset.METRICS, Dataset.SESSIONS, Dataset.ERRORS].includes(dataset) && (
                <RelatedIssues
                  organization={organization}
                  rule={rule}
                  projects={[project]}
                  timePeriod={timePeriod}
                  query={
                    dataset === Dataset.ERRORS
                      ? // Not using (query) AND (event.type:x) because issues doesn't support it yet
                        `${extractEventTypeFilterFromRule(rule)} ${query}`.trim()
                      : isCrashFreeAlert(dataset)
                        ? `${query} error.unhandled:true`.trim()
                        : undefined
                  }
                />
              )}
              {[Dataset.TRANSACTIONS, Dataset.GENERIC_METRICS].includes(dataset) && (
                <RelatedTransactions
                  organization={organization}
                  location={location}
                  rule={rule}
                  projects={[project]}
                  timePeriod={timePeriod}
                  filter={extractEventTypeFilterFromRule(rule)}
                />
              )}
            </ActivityWrapper>
          </DetailWrapper>
        </Layout.Main>
        <Layout.Side>
          <MetricDetailsSidebar
            rule={rule}
            showOnDemandMetricAlertUI={showOnDemandMetricAlertUI}
          />
        </Layout.Side>
      </Layout.Body>
    </Fragment>
  );
}

const DetailWrapper = styled('div')`
  display: flex;
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column-reverse;
  }
`;

const StyledLayoutBody = styled(Layout.Body)`
  flex-grow: 0;
  padding-bottom: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: auto;
  }
`;

const ActivityWrapper = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
`;

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const StyledSubHeader = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  align-items: center;
`;

const StyledTimeRangeSelector = styled(TimeRangeSelector)`
  margin-right: ${space(1)};
`;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
