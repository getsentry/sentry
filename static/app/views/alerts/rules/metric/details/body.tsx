import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {RuleActionsCategories} from 'sentry/types/alerts';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
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
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {getAlertRuleActionCategory} from 'sentry/views/alerts/rules/utils';
import type {Anomaly, Incident} from 'sentry/views/alerts/types';
import {AlertRuleStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';

import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

import type {TimePeriodType} from './constants';
import {SELECTOR_RELATIVE_PERIODS} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';
import {MetricDetailsSidebar} from './sidebar';
import {getFilter, getPeriodInterval} from './utils';

export interface MetricDetailsBodyProps extends RouteComponentProps {
  api: Client;
  location: Location;
  organization: Organization;
  timePeriod: TimePeriodType;
  anomalies?: Anomaly[];
  incidents?: Incident[];
  project?: Project;
  rule?: MetricRule;
  selectedIncident?: Incident | null;
}

export default function MetricDetailsBody({
  api,
  project,
  rule,
  incidents,
  organization,
  timePeriod,
  selectedIncident,
  location,
  router,
  anomalies,
}: MetricDetailsBodyProps) {
  const theme = useTheme();
  const handleTimePeriodChange = (datetime: ChangeData) => {
    const {start, end, relative} = datetime;

    if (start && end) {
      return router.push({
        ...location,
        query: {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
        },
      });
    }

    return router.push({
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

  const isSnoozed = rule.snooze;
  const ruleActionCategory = getAlertRuleActionCategory(rule);

  const showOnDemandMetricAlertUI =
    isOnDemandMetricAlert(dataset, aggregate, query) &&
    shouldShowOnDemandMetricAlertUI(organization);

  const formattedAggregate = aggregate;

  return (
    <Fragment>
      {selectedIncident?.alertRule.status === AlertRuleStatus.SNAPSHOT && (
        <StyledLayoutBody>
          <Alert type="warning" showIcon>
            {t('Alert Rule settings have been updated since this alert was triggered.')}
          </Alert>
        </StyledLayoutBody>
      )}
      <Layout.Body>
        <Layout.Main>
          {isSnoozed && (
            <Alert.Container>
              <Alert type="warning" showIcon>
                {ruleActionCategory === RuleActionsCategories.NO_DEFAULT
                  ? tct(
                      "[creator] muted this alert so these notifications won't be sent in the future.",
                      {creator: rule.snoozeCreatedBy}
                    )
                  : tct(
                      "[creator] muted this alert[forEveryone]so you won't get these notifications in the future.",
                      {
                        creator: rule.snoozeCreatedBy,
                        forEveryone: rule.snoozeForEveryone ? ' for everyone ' : ' ',
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
            api={api}
            rule={rule}
            incidents={incidents}
            anomalies={anomalies}
            timePeriod={timePeriod}
            formattedAggregate={formattedAggregate}
            organization={organization}
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column-reverse;
  }
`;

const StyledLayoutBody = styled(Layout.Body)`
  flex-grow: 0;
  padding-bottom: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
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
