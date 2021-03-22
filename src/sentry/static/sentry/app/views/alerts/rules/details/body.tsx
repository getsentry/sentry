import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import EventsRequest from 'app/components/charts/eventsRequest';
import {SectionHeading} from 'app/components/charts/styles';
import {getInterval} from 'app/components/charts/utils';
import DateTime from 'app/components/dateTime';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import * as Layout from 'app/components/layouts/thirds';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import {IconCheckmark, IconFire, IconUser, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
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
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'app/views/settings/incidentRules/utils/getEventTypeFilter';

import {Incident, IncidentStatus} from '../../types';
import {getIncidentRuleMetricPreset} from '../../utils';

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

  getMetricText(): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return '';
    }

    const {aggregate, timeWindow} = rule;

    return tct(' [metric] over [window]', {
      metric: aggregate,
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

  renderTrigger(trigger: Trigger): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return null;
    }

    const icon =
      trigger.label === 'critical' ? (
        <IconFire color="red300" size="sm" />
      ) : trigger.label === 'warning' ? (
        <IconWarning color="yellow300" size="sm" />
      ) : (
        <IconCheckmark color="green300" size="sm" isCircled />
      );

    const thresholdTypeText =
      rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Above') : t('Below');

    return (
      <TriggerCondition>
        {icon}
        <TriggerText>{`${thresholdTypeText} ${trigger.alertThreshold}`}</TriggerText>
      </TriggerCondition>
    );
  }

  renderRuleDetails() {
    const {rule} = this.props;

    if (rule === undefined) {
      return <Placeholder height="200px" />;
    }

    const criticalTrigger = rule?.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule?.triggers.find(({label}) => label === 'warning');

    const ownerId = rule.owner?.split(':')[1];
    const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};

    return (
      <React.Fragment>
        <SidebarHeading>{t('Metric')}</SidebarHeading>
        <RuleText>{this.getMetricText()}</RuleText>

        <SidebarHeading>{t('Environment')}</SidebarHeading>
        <RuleText>{rule.environment ?? 'All'}</RuleText>

        <SidebarHeading>{t('Filters')}</SidebarHeading>
        <Filters>
          <span>
            {rule?.dataset && <code>{DATASET_EVENT_TYPE_FILTERS[rule.dataset]}</code>}
          </span>
          <span>{rule?.query && <code>{rule?.query}</code>}</span>
        </Filters>

        <SidebarHeading>{t('Conditions')}</SidebarHeading>
        {criticalTrigger && this.renderTrigger(criticalTrigger)}
        {warningTrigger && this.renderTrigger(warningTrigger)}

        <SidebarHeading>{t('Other Details')}</SidebarHeading>
        <KeyValueTable>
          <Feature features={['organizations:team-alerts-ownership']}>
            <KeyValueTableRow
              keyName={t('Team')}
              value={
                teamActor ? (
                  <ActorAvatar actor={teamActor} size={24} />
                ) : (
                  <IconUser size="20px" color="gray400" />
                )
              }
            />
          </Feature>

          {rule.createdBy && (
            <KeyValueTableRow
              keyName={t('Created By')}
              value={<CreatedBy>{rule.createdBy.name ?? '-'}</CreatedBy>}
            />
          )}

          {rule.dateModified && (
            <KeyValueTableRow
              keyName={t('Last Modified')}
              value={<TimeSince date={rule.dateModified} suffix={t('ago')} />}
            />
          )}
        </KeyValueTable>
      </React.Fragment>
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
          <Button size="small" disabled={!rule} {...props}>
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
      <StatusContainer>
        <div>
          <SidebarHeading noMargin>{t('Status')}</SidebarHeading>
          <ItemValue>
            <AlertBadge color={color} icon={Icon}>
              <AlertIconWrapper>
                <Icon color="white" />
              </AlertIconWrapper>
            </AlertBadge>
            <IncidentStatusValue color={color}>{statusText}</IncidentStatusValue>
          </ItemValue>
        </div>
        <div>
          <SidebarHeading noMargin>
            {activeIncident ? t('Last Triggered') : t('Last Resolved')}
          </SidebarHeading>
          <ItemValue>{activityDate ? <TimeSince date={activityDate} /> : '-'}</ItemValue>
        </div>
      </StatusContainer>
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
          <Placeholder height="200px" />
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
                      <DateTime date={moment.utc(timePeriod.start)} timeAndDate />
                      {' — '}
                      <DateTime date={moment.utc(timePeriod.end)} timeAndDate />
                    </StyledTimeRange>
                  )}
                </ChartControls>
                <ChartPanel>
                  <PanelBody withPadding>
                    <ChartHeader>
                      <PresetName>
                        {this.metricPreset?.name ?? t('Custom metric')}
                      </PresetName>
                      {this.getMetricText()}
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
                      partial={false}
                    >
                      {({loading, timeseriesData}) =>
                        !loading && timeseriesData ? (
                          <MetricChart
                            data={timeseriesData}
                            ruleChangeThreshold={rule?.dateModified}
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
                  </ActivityWrapper>
                </DetailWrapper>
              </Layout.Main>
              <Layout.Side>
                {this.renderMetricStatus()}
                <Timeline api={api} orgId={orgId} rule={rule} incidents={incidents} />
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

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const IncidentStatusValue = styled('div')<{color: string}>`
  margin-left: 30px;
  color: ${p => p.color};
`;

const AlertBadge = styled('div')<{color: string; icon: React.ReactNode}>`
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* icon warning needs to be treated differently to look visually centered */
  line-height: ${p => (p.icon === IconWarning ? undefined : 1)};
  left: 3px;

  &:before {
    content: '';
    width: 20px;
    height: 20px;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.color};
    transform: rotate(45deg);
  }
`;

const AlertIconWrapper = styled('div')`
  position: absolute;

  svg {
    width: 13px;
    position: relative;
    top: 1px;
  }
`;

const StatusContainer = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: 16px;
  margin-bottom: 20px;
`;

const SidebarHeading = styled(SectionHeading)<{noMargin?: boolean}>`
  display: flex;
  justify-content: space-between;
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  line-height: 1;
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
  display: flex;
  flex-direction: row;
`;

const PresetName = styled('div')`
  text-transform: capitalize;
  margin-right: ${space(0.5)};
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${space(1)} 20px;
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
  color: ${p => p.theme.textColor};
`;

const RuleText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-left: ${space(0.5)};
`;

const Filters = styled('div')`
  width: 100%;
  overflow-wrap: break-word;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TriggerCondition = styled('div')`
  display: flex;
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;

export default withTheme(DetailsBody);
