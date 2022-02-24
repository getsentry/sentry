import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import AlertBadge from 'sentry/components/alertBadge';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {getInterval} from 'sentry/components/charts/utils';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import Duration from 'sentry/components/duration';
import IdBadge from 'sentry/components/idBadge';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import * as Layout from 'sentry/components/layouts/thirds';
import {Panel, PanelBody} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {IconDiamond, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor, DateString, Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import Projects from 'sentry/utils/projects';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/incidentRules/constants';
import {
  Action,
  AlertRuleThresholdType,
  Dataset,
  IncidentRule,
} from 'sentry/views/alerts/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/incidentRules/utils/getEventTypeFilter';
import Timeline from 'sentry/views/alerts/rules/details/timeline';

import {AlertRuleStatus, Incident, IncidentStatus} from '../../types';

import {API_INTERVAL_POINTS_LIMIT, TIME_OPTIONS, TimePeriodType} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';

type Props = {
  api: Client;
  handleTimePeriodChange: (value: string) => void;
  handleZoom: (start: DateString, end: DateString) => void;
  location: Location;
  organization: Organization;
  timePeriod: TimePeriodType;
  incidents?: Incident[];
  rule?: IncidentRule;
  selectedIncident?: Incident | null;
} & RouteComponentProps<{orgId: string}, {}>;

export default class DetailsBody extends React.Component<Props> {
  getMetricText(): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return '';
    }

    const {aggregate} = rule;

    return tct('[metric]', {
      metric: aggregate,
    });
  }

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

    if (
      timeWindow &&
      endDate.diff(startDate) < API_INTERVAL_POINTS_LIMIT * timeWindow * 60 * 1000
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

    const eventType =
      dataset === Dataset.SESSIONS ? null : extractEventTypeFilterFromRule(rule);
    const queryWithEventType = [eventType, query].join(' ').split(' ');

    return queryWithEventType;
  }

  renderTrigger(label: string, threshold: number, actions: Action[]): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return null;
    }

    const status =
      label === 'critical'
        ? t('Critical')
        : label === 'warning'
        ? t('Warning')
        : t('Resolved');
    const statusIcon =
      label === 'critical' ? (
        <StyledIconDiamond color="red300" size="md" />
      ) : label === 'warning' ? (
        <StyledIconDiamond color="yellow300" size="md" />
      ) : (
        <StyledIconDiamond color="green300" size="md" />
      );

    const thresholdTypeText = (
      label === 'resolved'
        ? rule.thresholdType === AlertRuleThresholdType.BELOW
        : rule.thresholdType === AlertRuleThresholdType.ABOVE
    )
      ? rule.comparisonDelta
        ? t('higher')
        : t('above')
      : rule.comparisonDelta
      ? t('lower')
      : t('below');

    const thresholdText = rule.comparisonDelta
      ? tct(
          'When [threshold]% [comparisonType] in [timeWindow] compared to [comparisonDelta]',
          {
            threshold,
            comparisonType: thresholdTypeText,
            timeWindow: this.getTimeWindow(),
            comparisonDelta: (
              COMPARISON_DELTA_OPTIONS.find(
                ({value}) => value === rule.comparisonDelta
              ) ?? COMPARISON_DELTA_OPTIONS[0]
            ).label,
          }
        )
      : tct('If  [condition] in [timeWindow]', {
          condition: `${thresholdTypeText} ${threshold}`,
          timeWindow: this.getTimeWindow(),
        });

    return (
      <TriggerConditionContainer>
        {statusIcon}
        <TriggerCondition>
          {status}
          <TriggerText>{thresholdText}</TriggerText>
          {actions.map(
            action =>
              action.desc && <TriggerText key={action.id}>{action.desc}</TriggerText>
          )}
        </TriggerCondition>
      </TriggerConditionContainer>
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
        <SidebarGroup>
          <Heading>{t('Metric')}</Heading>
          <RuleText>{this.getMetricText()}</RuleText>
        </SidebarGroup>

        <SidebarGroup>
          <Heading>{t('Environment')}</Heading>
          <RuleText>{rule.environment ?? 'All'}</RuleText>
        </SidebarGroup>

        <SidebarGroup>
          <Heading>{t('Thresholds')}</Heading>
          {typeof criticalTrigger?.alertThreshold === 'number' &&
            this.renderTrigger(
              criticalTrigger.label,
              criticalTrigger.alertThreshold,
              criticalTrigger.actions
            )}
          {typeof warningTrigger?.alertThreshold === 'number' &&
            this.renderTrigger(
              warningTrigger.label,
              warningTrigger.alertThreshold,
              warningTrigger.actions
            )}
          {typeof rule.resolveThreshold === 'number' &&
            this.renderTrigger('resolved', rule.resolveThreshold, [])}
        </SidebarGroup>

        <SidebarGroup>
          <Heading>{t('Other Details')}</Heading>
          <KeyValueTable>
            <KeyValueTableRow
              keyName={t('Team')}
              value={
                teamActor ? <ActorAvatar actor={teamActor} size={24} /> : 'Unassigned'
              }
            />

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
        </SidebarGroup>
      </React.Fragment>
    );
  }

  renderMetricStatus() {
    const {incidents} = this.props;

    // get current status
    const activeIncident = incidents?.find(({dateClosed}) => !dateClosed);
    const status = activeIncident ? activeIncident.status : IncidentStatus.CLOSED;

    const latestIncident = incidents?.length ? incidents[0] : null;
    // The date at which the alert was triggered or resolved
    const activityDate = activeIncident
      ? activeIncident.dateStarted
      : latestIncident
      ? latestIncident.dateClosed
      : null;

    return (
      <StatusContainer>
        <HeaderItem>
          <Heading noMargin>{t('Alert Status')}</Heading>
          <Status>
            <AlertBadge status={status} />
          </Status>
        </HeaderItem>
        <HeaderItem>
          <Heading noMargin>{t('Last Triggered')}</Heading>
          <Status>
            {activityDate ? <TimeSince date={activityDate} /> : t('No alerts triggered')}
          </Status>
        </HeaderItem>
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
      selectedIncident,
      handleZoom,
      params: {orgId},
    } = this.props;

    if (!rule) {
      return this.renderLoading();
    }

    const {query, projects: projectSlugs, dataset} = rule;

    const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();

    return (
      <Projects orgId={orgId} slugs={projectSlugs}>
        {({initiallyLoaded, projects}) => {
          return initiallyLoaded ? (
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
                  <HeaderContainer>
                    <HeaderGrid>
                      <HeaderItem>
                        <Heading noMargin>{t('Display')}</Heading>
                        <ChartControls>
                          <DropdownControl
                            label={
                              getDynamicText({
                                fixed: 'Oct 14, 2:56 PM — Oct 14, 4:55 PM',
                                value: timePeriod.display,
                              }) ?? '' // we should never get here because timePeriod.display is typed as always defined
                            }
                          >
                            {TIME_OPTIONS.map(({label, value}) => (
                              <DropdownItem
                                key={value}
                                eventKey={value}
                                isActive={
                                  !timePeriod.custom && timePeriod.period === value
                                }
                                onSelect={this.props.handleTimePeriodChange}
                              >
                                {label}
                              </DropdownItem>
                            ))}
                          </DropdownControl>
                        </ChartControls>
                      </HeaderItem>
                      {projects && projects.length && (
                        <HeaderItem>
                          <Heading noMargin>{t('Project')}</Heading>

                          <IdBadge avatarSize={16} project={projects[0]} />
                        </HeaderItem>
                      )}
                      <HeaderItem>
                        <Heading noMargin>
                          {t('Time Interval')}
                          <Tooltip
                            title={t(
                              'The time window over which the metric is evaluated.'
                            )}
                          >
                            <IconInfo size="xs" color="gray200" />
                          </Tooltip>
                        </Heading>

                        <RuleText>{this.getTimeWindow()}</RuleText>
                      </HeaderItem>
                    </HeaderGrid>
                  </HeaderContainer>

                  <MetricChart
                    api={api}
                    rule={rule}
                    incidents={incidents}
                    timePeriod={timePeriod}
                    selectedIncident={selectedIncident}
                    organization={organization}
                    projects={projects}
                    interval={this.getInterval()}
                    query={dataset === Dataset.SESSIONS ? query : queryWithTypeFilter}
                    filter={this.getFilter()}
                    orgId={orgId}
                    handleZoom={handleZoom}
                  />
                  <DetailWrapper>
                    <ActivityWrapper>
                      {[Dataset.SESSIONS, Dataset.ERRORS].includes(dataset) && (
                        <RelatedIssues
                          organization={organization}
                          rule={rule}
                          projects={((projects as Project[]) || []).filter(project =>
                            rule.projects.includes(project.slug)
                          )}
                          timePeriod={timePeriod}
                          query={
                            dataset === Dataset.ERRORS
                              ? queryWithTypeFilter
                              : dataset === Dataset.SESSIONS
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
                          projects={((projects as Project[]) || []).filter(project =>
                            rule.projects.includes(project.slug)
                          )}
                          start={timePeriod.start}
                          end={timePeriod.end}
                          filter={extractEventTypeFilterFromRule(rule)}
                        />
                      )}
                    </ActivityWrapper>
                  </DetailWrapper>
                </Layout.Main>
                <Layout.Side>
                  {this.renderMetricStatus()}
                  <Timeline
                    api={api}
                    organization={organization}
                    rule={rule}
                    incidents={incidents}
                  />
                  {this.renderRuleDetails()}
                </Layout.Side>
              </StyledLayoutBodyWrapper>
            </React.Fragment>
          ) : (
            <Placeholder height="200px" />
          );
        }}
      </Projects>
    );
  }
}

const SidebarGroup = styled('div')`
  margin-bottom: ${space(3)};
`;

const DetailWrapper = styled('div')`
  display: flex;
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column-reverse;
  }
`;

const HeaderContainer = styled('div')`
  height: 60px;
  display: flex;
  flex-direction: row;
  align-content: flex-start;
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: stretch;
  gap: 60px;
`;

const HeaderItem = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;

  > *:nth-child(2) {
    flex: 1;
    display: flex;
    align-items: center;
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

const Status = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StatusContainer = styled('div')`
  height: 60px;
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const Heading = styled(SectionHeading)<{noMargin?: boolean}>`
  display: grid;
  grid-template-columns: auto auto;
  justify-content: flex-start;
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  margin-bottom: ${space(0.5)};
  line-height: 1;
  gap: ${space(1)};
`;

const ChartControls = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const RuleText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const TriggerConditionContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

const TriggerCondition = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(0.75)};
  line-height: 1.4;
  position: relative;
  top: 2px;
`;

const TriggerText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;

const StyledIconDiamond = styled(IconDiamond)`
  margin-top: ${space(0.5)};
`;
