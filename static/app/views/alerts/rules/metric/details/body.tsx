import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {getInterval} from 'sentry/components/charts/utils';
import Duration from 'sentry/components/duration';
import * as Layout from 'sentry/components/layouts/thirds';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {Panel, PanelBody} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import MetricHistory from 'sentry/views/alerts/rules/metric/details/metricHistory';
import {Dataset, MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';

import {AlertRuleStatus, Incident} from '../../../types';
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
import Sidebar from './sidebar';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  timePeriod: TimePeriodType;
  incidents?: Incident[];
  project?: Project;
  rule?: MetricRule;
  selectedIncident?: Incident | null;
} & RouteComponentProps<{}, {}>;

export default class DetailsBody extends Component<Props> {
  getTimeWindow(): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return '';
    }

    const {timeWindow} = rule;

    return tct('[window]', {
      window: <Duration seconds={timeWindow * 60} />,
    });
  }

  getInterval() {
    const {
      timePeriod: {start, end},
      rule,
    } = this.props;
    const startDate = moment.utc(start);
    const endDate = moment.utc(end);
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

    return getInterval({start, end}, 'high');
  }

  getFilter() {
    const {rule} = this.props;
    const {dataset, query} = rule ?? {};
    if (!rule) {
      return null;
    }

    const eventType = isCrashFreeAlert(dataset)
      ? null
      : extractEventTypeFilterFromRule(rule);
    return [eventType, query].join(' ').split(' ');
  }

  handleTimePeriodChange = (datetime: ChangeData) => {
    const {start, end, relative} = datetime;

    if (start && end) {
      return this.props.router.push({
        ...this.props.location,
        query: {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
        },
      });
    }

    return this.props.router.push({
      ...this.props.location,
      query: {
        period: relative,
      },
    });
  };

  renderLoading() {
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

  render() {
    const {
      api,
      project,
      rule,
      incidents,
      location,
      organization,
      timePeriod,
      selectedIncident,
    } = this.props;

    if (!rule || !project) {
      return this.renderLoading();
    }

    const {query, dataset} = rule;

    const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();
    const relativeOptions = {
      ...SELECTOR_RELATIVE_PERIODS,
      ...(rule.timeWindow > 1 ? {[TimePeriod.FOURTEEN_DAYS]: t('Last 14 days')} : {}),
    };

    return (
      <Fragment>
        {selectedIncident &&
          selectedIncident.alertRule.status === AlertRuleStatus.SNAPSHOT && (
            <StyledLayoutBody>
              <StyledAlert type="warning" showIcon>
                {t(
                  'Alert Rule settings have been updated since this alert was triggered.'
                )}
              </StyledAlert>
            </StyledLayoutBody>
          )}
        <Layout.Body>
          <Layout.Main>
            <StyledPageTimeRangeSelector
              organization={organization}
              relative={timePeriod.period ?? ''}
              start={(timePeriod.custom && timePeriod.start) || null}
              end={(timePeriod.custom && timePeriod.end) || null}
              utc={null}
              onUpdate={this.handleTimePeriodChange}
              relativeOptions={relativeOptions}
              showAbsolute={false}
            />

            <MetricChart
              api={api}
              rule={rule}
              incidents={incidents}
              timePeriod={timePeriod}
              selectedIncident={selectedIncident}
              organization={organization}
              project={project}
              interval={this.getInterval()}
              query={isCrashFreeAlert(dataset) ? query : queryWithTypeFilter}
              filter={this.getFilter()}
            />
            <DetailWrapper>
              <ActivityWrapper>
                <MetricHistory organization={organization} incidents={incidents} />
                {[Dataset.METRICS, Dataset.SESSIONS, Dataset.ERRORS].includes(
                  dataset
                ) && (
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
            <Sidebar rule={rule} />
          </Layout.Side>
        </Layout.Body>
      </Fragment>
    );
  }
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
