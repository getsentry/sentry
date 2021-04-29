import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import {SectionHeading} from 'app/components/charts/styles';
import {getInterval} from 'app/components/charts/utils';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import IdBadge from 'app/components/idBadge';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import * as Layout from 'app/components/layouts/thirds';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconFire, IconInfo, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import Timeline from 'app/views/alerts/rules/details/timeline';
import {
  AlertRuleThresholdType,
  Dataset,
  IncidentRule,
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'app/views/settings/incidentRules/utils/getEventTypeFilter';

import AlertBadge from '../../alertBadge';
import {AlertRuleStatus, Incident, IncidentStatus} from '../../types';

import {API_INTERVAL_POINTS_LIMIT, TIME_OPTIONS, TimePeriodType} from './constants';
import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';
import RelatedTransactions from './relatedTransactions';

type Props = {
  api: Client;
  rule?: IncidentRule;
  incidents?: Incident[];
  timePeriod: TimePeriodType;
  selectedIncident?: Incident | null;
  organization: Organization;
  location: Location;
  handleTimePeriodChange: (value: string) => void;
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

    return getInterval({start, end}, true);
  }

  getFilter() {
    const {rule} = this.props;
    if (!rule) {
      return null;
    }

    return (
      <Filters>
        <code>{extractEventTypeFilterFromRule(rule)}</code>&nbsp;&nbsp;
        {rule.query && <code>{rule.query}</code>}
      </Filters>
    );
  }

  renderTrigger(trigger: Trigger): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return null;
    }

    const status =
      trigger.label === 'critical' ? (
        <StatusWrapper>
          <IconFire color="red300" size="sm" /> Critical
        </StatusWrapper>
      ) : trigger.label === 'warning' ? (
        <StatusWrapper>
          <IconWarning color="yellow300" size="sm" /> Warning
        </StatusWrapper>
      ) : (
        <StatusWrapper>
          <IconCheckmark color="green300" size="sm" isCircled /> Resolved
        </StatusWrapper>
      );

    const thresholdTypeText =
      rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('above') : t('below');

    return (
      <TriggerCondition>
        {status}
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
        <SidebarGroup>
          <SidebarHeading>{t('Metric')}</SidebarHeading>
          <RuleText>{this.getMetricText()}</RuleText>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarHeading>{t('Environment')}</SidebarHeading>
          <RuleText>{rule.environment ?? 'All'}</RuleText>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarHeading>{t('Filters')}</SidebarHeading>
          {this.getFilter()}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarHeading>{t('Conditions')}</SidebarHeading>
          {criticalTrigger && this.renderTrigger(criticalTrigger)}
          {warningTrigger && this.renderTrigger(warningTrigger)}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarHeading>{t('Other Details')}</SidebarHeading>
          <KeyValueTable>
            <Feature features={['organizations:team-alerts-ownership']}>
              <KeyValueTableRow
                keyName={t('Team')}
                value={
                  teamActor ? <ActorAvatar actor={teamActor} size={24} /> : 'Unassigned'
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
        <div>
          <SidebarHeading noMargin>{t('Status')}</SidebarHeading>
          <ItemValue>
            <AlertBadge status={status} />
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
      selectedIncident,
      params: {orgId},
    } = this.props;

    if (!rule) {
      return this.renderLoading();
    }

    const {query, projects: projectSlugs} = rule;

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
                      <div>
                        <SidebarHeading noMargin>{t('Display')}</SidebarHeading>
                        <ChartControls>
                          <DropdownControl label={timePeriod.display}>
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
                        </ChartControls>
                      </div>
                      {projects && projects.length && (
                        <div>
                          <SidebarHeading noMargin>{t('Project')}</SidebarHeading>

                          <IdBadge avatarSize={16} project={projects[0]} />
                        </div>
                      )}
                      <div>
                        <SidebarHeading noMargin>
                          {t('Time Interval')}
                          <Tooltip
                            title={t(
                              'This is the time period which the metric is evaluated by.'
                            )}
                          >
                            <IconInfo size="xs" color="gray200" />
                          </Tooltip>
                        </SidebarHeading>

                        <RuleText>{this.getTimeWindow()}</RuleText>
                      </div>
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
                    metricText={this.getMetricText()}
                    interval={this.getInterval()}
                    filter={this.getFilter()}
                    query={queryWithTypeFilter}
                    orgId={orgId}
                  />
                  <DetailWrapper>
                    <ActivityWrapper>
                      {rule?.dataset === Dataset.ERRORS && (
                        <RelatedIssues
                          organization={organization}
                          rule={rule}
                          projects={((projects as Project[]) || []).filter(project =>
                            rule.projects.includes(project.slug)
                          )}
                          timePeriod={timePeriod}
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
                          filter={extractEventTypeFilterFromRule(rule)}
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

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
  svg {
    margin-right: ${space(0.5)};
  }
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-content: flex-start;
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: flex-start;
  gap: ${space(4)};
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

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StatusContainer = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: 16px;
  margin-bottom: 20px;
`;

const SidebarHeading = styled(SectionHeading)<{noMargin?: boolean}>`
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

const Filters = styled('span')`
  width: 100%;
  overflow-wrap: break-word;
  font-size: ${p => p.theme.fontSizeMedium};
  gap: ${space(1)};
`;

const TriggerCondition = styled('div')`
  display: flex;
  align-items: center;
`;

const TriggerText = styled('div')`
  margin-left: ${space(0.5)};
  white-space: nowrap;
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;
