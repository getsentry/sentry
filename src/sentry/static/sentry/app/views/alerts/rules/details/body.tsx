import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import EventsRequest from 'app/components/charts/eventsRequest';
import {SectionHeading} from 'app/components/charts/styles';
import {getInterval} from 'app/components/charts/utils';
import DateTime from 'app/components/dateTime';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import * as Layout from 'app/components/layouts/thirds';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import {IconCheckmark} from 'app/icons/iconCheckmark';
import {IconFire} from 'app/icons/iconFire';
import {IconWarning} from 'app/icons/iconWarning';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import Projects from 'app/utils/projects';
import {Theme} from 'app/utils/theme';
import Timeline from 'app/views/alerts/rules/details/timeline';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/settings/incidentRules/constants';
import {makeDefaultCta} from 'app/views/settings/incidentRules/incidentRulePresets';
import {
  AlertRuleThresholdType,
  Dataset,
  IncidentRule,
} from 'app/views/settings/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'app/views/settings/incidentRules/utils/getEventTypeFilter';

import {Incident, IncidentStatus} from '../../types';
import {DATA_SOURCE_LABELS, getIncidentRuleMetricPreset} from '../../utils';

import {API_INTERVAL_POINTS_LIMIT, TIME_OPTIONS} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';

type Props = {
  api: Client;
  rule?: IncidentRule;
  incidents?: Incident[];
  timePeriod: {
    start: string;
    end: string;
    label: string;
    custom?: boolean;
  };
  organization: Organization;
  location: Location;
  theme: Theme;
  handleTimePeriodChange: (value: string) => void;
} & RouteComponentProps<{orgId: string}, {}>;

class DetailsBody extends React.Component<Props> {
  get metricPreset() {
    const {rule} = this.props;
    return rule ? getIncidentRuleMetricPreset(rule) : undefined;
  }

  /**
   * Return a string describing the threshold based on the threshold and the type
   */
  getThresholdText(
    value: number | '' | null | undefined,
    thresholdType?: AlertRuleThresholdType,
    isAlert: boolean = false
  ) {
    if (!defined(value) || !defined(thresholdType)) {
      return '';
    }

    const isAbove = thresholdType === AlertRuleThresholdType.ABOVE;
    const direction = isAbove === isAlert ? '>' : '<';

    return `${direction} ${value}`;
  }

  getInterval() {
    const {
      timePeriod: {start, end},
      rule,
    } = this.props;
    const startDate = moment.utc(start);
    const endDate = moment.utc(end);
    const timeWindow = rule?.timeWindow;

    if (
      timeWindow &&
      endDate.diff(startDate) < API_INTERVAL_POINTS_LIMIT * timeWindow * 60 * 1000
    ) {
      return `${timeWindow}m`;
    }

    return getInterval({start, end}, true);
  }

  calculateSummaryPercentages(
    incidents: Incident[] | undefined,
    startTime: string,
    endTime: string
  ) {
    const startDate = moment.utc(startTime);
    const endDate = moment.utc(endTime);
    const totalTime = endDate.diff(startDate);

    let criticalPercent = '0';
    let warningPercent = '0';
    if (incidents) {
      const filteredIncidents = incidents.filter(incident => {
        return !incident.dateClosed || moment(incident.dateClosed).isAfter(startDate);
      });
      let criticalDuration = 0;
      const warningDuration = 0;
      for (const incident of filteredIncidents) {
        // use the larger of the start of the incident or the start of the time period
        const incidentStart = moment.max(moment(incident.dateStarted), startDate);
        const incidentClose = incident.dateClosed ? moment(incident.dateClosed) : endDate;
        criticalDuration += incidentClose.diff(incidentStart);
      }
      criticalPercent = ((criticalDuration / totalTime) * 100).toFixed(2);
      warningPercent = ((warningDuration / totalTime) * 100).toFixed(2);
    }
    const resolvedPercent = (
      100 -
      (Number(criticalPercent) + Number(warningPercent))
    ).toFixed(2);

    return {criticalPercent, warningPercent, resolvedPercent};
  }

  renderRuleDetails() {
    const {rule} = this.props;

    if (rule === undefined) {
      return <Placeholder height="200px" />;
    }

    const criticalTrigger = rule?.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule?.triggers.find(({label}) => label === 'warning');

    return (
      <RuleDetails>
        <span>{t('Data Source')}</span>
        <span>{rule?.dataset && DATA_SOURCE_LABELS[rule?.dataset]}</span>

        <span>{t('Metric')}</span>
        <span>{rule?.aggregate}</span>

        <span>{t('Time Window')}</span>
        <span>{rule?.timeWindow && <Duration seconds={rule?.timeWindow * 60} />}</span>

        {rule?.query && (
          <React.Fragment>
            <span>{t('Filter')}</span>
            <span title={rule?.query}>{rule?.query}</span>
          </React.Fragment>
        )}

        <span>{t('Critical Trigger')}</span>
        <span>
          {this.getThresholdText(
            criticalTrigger?.alertThreshold,
            rule?.thresholdType,
            true
          )}
        </span>

        {defined(warningTrigger) && (
          <React.Fragment>
            <span>{t('Warning Trigger')}</span>
            <span>
              {this.getThresholdText(
                warningTrigger?.alertThreshold,
                rule?.thresholdType,
                true
              )}
            </span>
          </React.Fragment>
        )}

        {defined(rule?.resolveThreshold) && (
          <React.Fragment>
            <span>{t('Resolution')}</span>
            <span>
              {this.getThresholdText(rule?.resolveThreshold, rule?.thresholdType)}
            </span>
          </React.Fragment>
        )}
      </RuleDetails>
    );
  }

  renderSummaryStatItems({
    criticalPercent,
    warningPercent,
    resolvedPercent,
  }: {
    criticalPercent: string;
    warningPercent: string;
    resolvedPercent: string;
  }) {
    return (
      <React.Fragment>
        <StatItem>
          <IconCheckmark color="green300" isCircled />
          <StatCount>{resolvedPercent}%</StatCount>
        </StatItem>
        <StatItem>
          <IconWarning color="yellow300" />
          <StatCount>{warningPercent}%</StatCount>
        </StatItem>
        <StatItem>
          <IconFire color="red300" />
          <StatCount>{criticalPercent}%</StatCount>
        </StatItem>
      </React.Fragment>
    );
  }

  renderChartActions(projects: Project[]) {
    const {rule, params, incidents, timePeriod} = this.props;
    const preset = this.metricPreset;
    const ctaOpts = {
      orgSlug: params.orgId,
      projects,
      rule,
      start: timePeriod.start,
      end: timePeriod.end,
    };

    const {buttonText, ...props} = preset
      ? preset.makeCtaParams(ctaOpts)
      : makeDefaultCta(ctaOpts);

    const percentages = this.calculateSummaryPercentages(
      incidents,
      timePeriod.start,
      timePeriod.end
    );

    return (
      <ChartActions>
        <ChartSummary>
          <SummaryText>{t('SUMMARY')}</SummaryText>
          <SummaryStats>{this.renderSummaryStatItems(percentages)}</SummaryStats>
        </ChartSummary>
        <Feature features={['discover-basic']}>
          <Button size="small" priority="primary" disabled={!rule} {...props}>
            {buttonText}
          </Button>
        </Feature>
      </ChartActions>
    );
  }

  renderMetricStatus() {
    const {incidents, theme} = this.props;

    // get current status
    const activeIncident = incidents?.find(({dateClosed}) => !dateClosed);
    const status = activeIncident ? activeIncident.status : IncidentStatus.CLOSED;
    let statusText = t('Okay');
    let Icon = IconCheckmark;
    let color: string = theme.green300;
    if (status === IncidentStatus.CRITICAL) {
      statusText = t('Critical');
      Icon = IconFire;
      color = theme.red300;
    } else if (status === IncidentStatus.WARNING) {
      statusText = t('Warning');
      Icon = IconWarning;
      color = theme.yellow300;
    }

    const latestIncident = incidents?.length ? incidents[0] : null;
    // The date at which the alert was triggered or resolved
    const activityDate = activeIncident
      ? activeIncident.dateStarted
      : latestIncident
      ? latestIncident.dateClosed
      : null;

    return (
      <GroupedHeaderItems>
        <ItemTitle>{t('Current Status')}</ItemTitle>
        <ItemTitle>{activeIncident ? t('Last Triggered') : t('Last Resolved')}</ItemTitle>
        <ItemValue>
          <AlertBadge color={color} icon={Icon}>
            <AlertIconWrapper>
              <Icon color="white" />
            </AlertIconWrapper>
          </AlertBadge>
          <IncidentStatusValue color={color}>{statusText}</IncidentStatusValue>
        </ItemValue>
        <ItemValue>{activityDate ? <TimeSince date={activityDate} /> : '-'}</ItemValue>
      </GroupedHeaderItems>
    );
  }

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
          <SidebarHeading>
            <span>{t('Alert Rule')}</span>
          </SidebarHeading>
          {this.renderRuleDetails()}
        </Layout.Side>
      </Layout.Body>
    );
  }

  render() {
    const {
      api,
      rule,
      incidents,
      location,
      organization,
      timePeriod,
      params: {orgId},
    } = this.props;

    if (!rule) {
      return this.renderLoading();
    }

    const {query, environment, aggregate, projects: projectSlugs, triggers} = rule;

    const criticalTrigger = triggers.find(({label}) => label === 'critical');
    const warningTrigger = triggers.find(({label}) => label === 'warning');
    const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();

    return (
      <Projects orgId={orgId} slugs={projectSlugs}>
        {({initiallyLoaded, projects}) => {
          return initiallyLoaded ? (
            <Layout.Body>
              <Layout.Main>
                <ChartControls>
                  <DropdownControl label={timePeriod.label}>
                    {TIME_OPTIONS.map(({label, value}) => (
                      <DropdownItem
                        key={value}
                        eventKey={value}
                        onSelect={this.props.handleTimePeriodChange}
                      >
                        {label}
                      </DropdownItem>
                    ))}
                  </DropdownControl>
                  {timePeriod.custom && (
                    <StyledTimeRange>
                      <DateTime date={timePeriod.start} timeAndDate />
                      {' — '}
                      <DateTime date={timePeriod.end} timeAndDate />
                    </StyledTimeRange>
                  )}
                </ChartControls>
                <ChartPanel>
                  <PanelBody withPadding>
                    <ChartHeader>
                      {this.metricPreset?.name ?? t('Custom metric')}
                    </ChartHeader>
                    <EventsRequest
                      api={api}
                      organization={organization}
                      query={queryWithTypeFilter}
                      environment={environment ? [environment] : undefined}
                      project={(projects as Project[]).map(project => Number(project.id))}
                      interval={this.getInterval()}
                      start={timePeriod.start}
                      end={timePeriod.end}
                      yAxis={aggregate}
                      includePrevious={false}
                      currentSeriesName={aggregate}
                    >
                      {({loading, timeseriesData}) =>
                        !loading && timeseriesData ? (
                          <MetricChart
                            data={timeseriesData}
                            incidents={incidents}
                            criticalTrigger={criticalTrigger}
                            warningTrigger={warningTrigger}
                          />
                        ) : (
                          <Placeholder height="200px" />
                        )
                      }
                    </EventsRequest>
                  </PanelBody>
                  {this.renderChartActions(projects as Project[])}
                </ChartPanel>
                <DetailWrapper>
                  <ActivityWrapper>
                    {rule?.dataset === Dataset.ERRORS && (
                      <RelatedIssues
                        organization={organization}
                        rule={rule}
                        projects={((projects as Project[]) || []).filter(project =>
                          rule.projects.includes(project.slug)
                        )}
                        start={timePeriod.start}
                        end={timePeriod.end}
                        filter={queryWithTypeFilter}
                      />
                    )}
                    {rule?.dataset === Dataset.TRANSACTIONS && (
                      <RelatedTransactions
                        organization={organization}
                        location={location}
                        rule={rule}
                        projects={((projects as Project[]) || []).filter(project =>
                          rule.projects.includes(project.slug)
                        )}
                        start={timePeriod.start}
                        end={timePeriod.end}
                        filter={DATASET_EVENT_TYPE_FILTERS[rule.dataset]}
                      />
                    )}
                    <Timeline api={api} orgId={orgId} rule={rule} incidents={incidents} />
                  </ActivityWrapper>
                </DetailWrapper>
              </Layout.Main>
              <Layout.Side>
                {this.renderMetricStatus()}
                <ChartParameters>
                  {tct('Metric: [metric] over [window]', {
                    metric: <code>{rule?.aggregate ?? '\u2026'}</code>,
                    window: (
                      <code>
                        {rule?.timeWindow ? (
                          <Duration seconds={rule?.timeWindow * 60} />
                        ) : (
                          '\u2026'
                        )}
                      </code>
                    ),
                  })}
                  {(rule?.query || rule?.dataset) &&
                    tct('Filter: [datasetType] [filter]', {
                      datasetType: rule?.dataset && (
                        <code>{DATASET_EVENT_TYPE_FILTERS[rule.dataset]}</code>
                      ),
                      filter: rule?.query && <code>{rule.query}</code>,
                    })}
                </ChartParameters>
                <SidebarHeading>
                  <span>{t('Alert Rule')}</span>
                </SidebarHeading>
                {this.renderRuleDetails()}
              </Layout.Side>
            </Layout.Body>
          ) : (
            <Placeholder height="200px" />
          );
        }}
      </Projects>
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

const ActivityWrapper = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
`;

const GroupedHeaderItems = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(1)} ${space(4)};
  text-align: right;
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
`;

const ItemTitle = styled('h6')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
  letter-spacing: 0.1px;
`;

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const IncidentStatusValue = styled('div')<{color: string}>`
  margin-left: ${space(1.5)};
  color: ${p => p.color};
`;

const AlertBadge = styled('div')<{color: string; icon: React.ReactNode}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* icon warning needs to be treated differently to look visually centered */
  line-height: ${p => (p.icon === IconWarning ? undefined : 1)};

  &:before {
    content: '';
    width: 30px;
    height: 30px;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.color};
    transform: rotate(45deg);
  }
`;

const AlertIconWrapper = styled('div')`
  position: absolute;
`;

const SidebarHeading = styled(SectionHeading)`
  display: flex;
  justify-content: space-between;
`;

const ChartControls = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledTimeRange = styled('div')`
  margin-left: ${space(2)};
`;

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const ChartHeader = styled('header')`
  margin-bottom: ${space(1)};
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${space(2)};
`;

const ChartSummary = styled('div')`
  display: flex;
  margin-right: auto;
`;

const SummaryText = styled('span')`
  margin-top: ${space(0.25)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SummaryStats = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(2)};
`;

const StatItem = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(2)} 0 0;
`;

const StatCount = styled('span')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  color: black;
`;

const ChartParameters = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;
  overflow-x: auto;

  > * {
    position: relative;
  }

  > *:not(:last-of-type):after {
    content: '';
    display: block;
    height: 70%;
    width: 1px;
    background: ${p => p.theme.gray200};
    position: absolute;
    right: -${space(2)};
    top: 15%;
  }
`;

const RuleDetails = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSizeSmall};
  grid-template-columns: auto max-content;
  margin-bottom: ${space(2)};

  & > span {
    padding: ${space(0.5)} ${space(1)};
  }

  & > span:nth-child(2n + 1) {
    width: 125px;
  }

  & > span:nth-child(2n + 2) {
    text-align: right;
    width: 215px;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  & > span:nth-child(4n + 1),
  & > span:nth-child(4n + 2) {
    background-color: ${p => p.theme.rowBackground};
  }
`;

export default withTheme(DetailsBody);
