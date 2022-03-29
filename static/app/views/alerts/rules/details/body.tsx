import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import {getInterval} from 'sentry/components/charts/utils';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import Duration from 'sentry/components/duration';
import * as Layout from 'sentry/components/layouts/thirds';
import {Panel, PanelBody} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Dataset, IncidentRule, TimePeriod} from 'sentry/views/alerts/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/incidentRules/utils/getEventTypeFilter';
import MetricHistory from 'sentry/views/alerts/rules/details/metricHistory';

import {isCrashFreeAlert} from '../../incidentRules/utils/isCrashFreeAlert';
import {AlertRuleStatus, Incident} from '../../types';

import {
  API_INTERVAL_POINTS_LIMIT,
  TIME_OPTIONS,
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
  rule?: IncidentRule;
  selectedIncident?: Incident | null;
} & RouteComponentProps<{orgId: string}, {}>;

export default class DetailsBody extends React.Component<Props> {
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
    const queryWithEventType = [eventType, query].join(' ').split(' ');

    return queryWithEventType;
  }

  handleTimePeriodChange = (value: string) => {
    browserHistory.push({
      pathname: this.props.location.pathname,
      query: {
        period: value,
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
      params: {orgId},
    } = this.props;

    if (!rule || !project) {
      return this.renderLoading();
    }

    const {query, dataset} = rule;

    const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();

    return (
      <React.Fragment>
        {selectedIncident &&
          selectedIncident.alertRule.status === AlertRuleStatus.SNAPSHOT && (
            <StyledLayoutBody>
              <StyledAlert type="warning" icon={<IconInfo size="md" />}>
                {t(
                  'Alert Rule settings have been updated since this alert was triggered.'
                )}
              </StyledAlert>
            </StyledLayoutBody>
          )}
        <StyledLayoutBodyWrapper>
          <Layout.Main>
            <DateContainer>
              <StyledDropdownControl
                label={getDynamicText({
                  fixed: (
                    <div>
                      {t('Date Range')}:{' '}
                      <DropdownLabel>Oct 14, 2:56 PM — Oct 14, 4:55 PM</DropdownLabel>
                    </div>
                  ),
                  value: (
                    <div>
                      {t('Date Range')}:{' '}
                      <DropdownLabel>{timePeriod.display}</DropdownLabel>
                    </div>
                  ),
                })}
              >
                {TIME_OPTIONS.map(({label, value}) => (
                  <DropdownItem
                    key={value}
                    eventKey={value}
                    isActive={!timePeriod.custom && timePeriod.period === value}
                    onSelect={this.handleTimePeriodChange}
                  >
                    {label}
                  </DropdownItem>
                ))}
              </StyledDropdownControl>
            </DateContainer>

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
              orgId={orgId}
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
                    start={timePeriod.start}
                    end={timePeriod.end}
                    filter={extractEventTypeFilterFromRule(rule)}
                  />
                )}
              </ActivityWrapper>
            </DetailWrapper>
          </Layout.Main>
          <Layout.Side>
            <Sidebar incidents={incidents} rule={rule} />
          </Layout.Side>
        </StyledLayoutBodyWrapper>
      </React.Fragment>
    );
  }
}

const DetailWrapper = styled('div')`
  display: flex;
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column-reverse;
  }
`;

const DateContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const DropdownLabel = styled('span')`
  font-weight: 400;
`;

const StyledDropdownControl = styled(DropdownControl)`
  width: 100%;
  button {
    width: 100%;
    span {
      justify-content: space-between;
    }
  }
`;

const StyledLayoutBody = styled(Layout.Body)`
  flex-grow: 0;
  padding-bottom: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: auto;
  }
`;

const StyledLayoutBodyWrapper = styled(Layout.Body)`
  margin-bottom: -${space(3)};
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
