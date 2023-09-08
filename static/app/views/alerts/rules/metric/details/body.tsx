import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {getInterval} from 'sentry/components/charts/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import {RuleActionsCategories} from 'sentry/types/alerts';
import MetricHistory from 'sentry/views/alerts/rules/metric/details/metricHistory';
import {Dataset, MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {getAlertRuleActionCategory} from 'sentry/views/alerts/rules/utils';
import {AlertRuleStatus, Incident} from 'sentry/views/alerts/types';

import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

import {
  API_INTERVAL_POINTS_LIMIT,
  SELECTOR_RELATIVE_PERIODS,
  TIME_WINDOWS,
  TimePeriodType,
} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';
import {MetricDetailsSidebar} from './sidebar';

interface MetricDetailsBodyProps extends RouteComponentProps<{}, {}> {
  api: Client;
  location: Location;
  organization: Organization;
  timePeriod: TimePeriodType;
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
}: MetricDetailsBodyProps) {
  function getPeriodInterval() {
    const startDate = moment.utc(timePeriod.start);
    const endDate = moment.utc(timePeriod.end);
    const timeWindow = rule?.timeWindow;
    const startEndDifferenceMs = endDate.diff(startDate);

    if (
      timeWindow &&
      (startEndDifferenceMs < API_INTERVAL_POINTS_LIMIT * timeWindow * 60 * 1000 ||
        // Special case 7 days * 1m interval over the api limit
        startEndDifferenceMs === TIME_WINDOWS[TimePeriod.SEVEN_DAYS])
    ) {
      return `${timeWindow}m`;
    }

    return getInterval({start: timePeriod.start, end: timePeriod.end}, 'high');
  }

  function getFilter() {
    const {dataset, query} = rule ?? {};
    if (!rule) {
      return null;
    }

    const eventType = isCrashFreeAlert(dataset)
      ? null
      : extractEventTypeFilterFromRule(rule);
    return [eventType, query].join(' ').split(' ');
  }

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

  const {query, dataset} = rule;

  const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();
  const relativeOptions = {
    ...SELECTOR_RELATIVE_PERIODS,
    ...(rule.timeWindow > 1 ? {[TimePeriod.FOURTEEN_DAYS]: t('Last 14 days')} : {}),
  };

  const isSnoozed = rule.snooze;
  const ruleActionCategory = getAlertRuleActionCategory(rule);

  const isOnDemandAlert = isOnDemandMetricAlert(dataset, query);

  return (
    <Fragment>
      {selectedIncident?.alertRule.status === AlertRuleStatus.SNAPSHOT && (
        <StyledLayoutBody>
          <StyledAlert type="warning" showIcon>
            {t('Alert Rule settings have been updated since this alert was triggered.')}
          </StyledAlert>
        </StyledLayoutBody>
      )}
      <Layout.Body>
        <Layout.Main>
          {isSnoozed && (
            <Alert showIcon>
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
          )}
          <StyledPageTimeRangeSelector
            organization={organization}
            relative={timePeriod.period ?? ''}
            start={(timePeriod.custom && timePeriod.start) || null}
            end={(timePeriod.custom && timePeriod.end) || null}
            utc={null}
            onUpdate={handleTimePeriodChange}
            relativeOptions={relativeOptions}
            showAbsolute={false}
            disallowArbitraryRelativeRanges
          />

          <MetricChart
            api={api}
            rule={rule}
            incidents={incidents}
            timePeriod={timePeriod}
            selectedIncident={selectedIncident}
            organization={organization}
            project={project}
            interval={getPeriodInterval()}
            query={isCrashFreeAlert(dataset) ? query : queryWithTypeFilter}
            filter={getFilter()}
            isOnDemandAlert={isOnDemandAlert}
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
                      ? queryWithTypeFilter
                      : isCrashFreeAlert(dataset)
                      ? `${query} error.unhandled:true`
                      : undefined
                  }
                />
              )}
              {dataset === Dataset.TRANSACTIONS && (
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
            isOnDemandMetricAlert={isOnDemandMetricAlert(dataset, query)}
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

const StyledAlert = styled(Alert)`
  margin: 0;
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

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  margin-bottom: ${space(2)};
`;
