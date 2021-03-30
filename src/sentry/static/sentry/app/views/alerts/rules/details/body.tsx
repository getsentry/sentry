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
import DateTime from 'app/components/dateTime';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import * as Layout from 'app/components/layouts/thirds';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconFire, IconInfo, IconUser, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import theme from 'app/utils/theme';
import Timeline from 'app/views/alerts/rules/details/timeline';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/settings/incidentRules/constants';
import {
  AlertRuleThresholdType,
  Dataset,
  IncidentRule,
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {extractEventTypeFilterFromRule} from 'app/views/settings/incidentRules/utils/getEventTypeFilter';

import {Incident, IncidentStatus} from '../../types';

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

  renderMetricStatus() {
    const {incidents} = this.props;

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

    const {query, projects: projectSlugs} = rule;

    const queryWithTypeFilter = `${query} ${extractEventTypeFilterFromRule(rule)}`.trim();

    return (
      <Projects orgId={orgId} slugs={projectSlugs}>
        {({initiallyLoaded, projects}) => {
          return initiallyLoaded ? (
            <React.Fragment>
              <StyledAlert type="info" icon={<IconInfo size="md" />}>
                {t(
                  'You’re viewing the new alert details page. To view the old experience, select an alert on the chart or in the history.'
                )}
              </StyledAlert>
              <Layout.Body>
                <Layout.Main>
                  <HeaderContainer>
                    <div>
                      <SidebarHeading noMargin>{t('Display')}</SidebarHeading>
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
                    </div>
                    <div>
                      <SidebarHeading noMargin>
                        {t('Time Interval')}
                        <Tooltip title="This is the time period which the metric is evaluated by.">
                          <IconInfo size="xs" />
                        </Tooltip>
                      </SidebarHeading>

                      <RuleText>{this.getTimeWindow()}</RuleText>
                    </div>
                  </HeaderContainer>

                  <MetricChart
                    api={api}
                    rule={rule}
                    incidents={incidents}
                    timePeriod={timePeriod}
                    organization={organization}
                    projects={projects}
                    metricText={this.getMetricText()}
                    interval={this.getInterval()}
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
            </React.Fragment>
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

const HeaderContainer = styled('div')`
  display: flex;
  gap: ${space(4)};
`;

const StyledAlert = styled(Alert)`
  margin: ${space(3)} ${space(4)} 0;
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

const RuleText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Filters = styled('div')`
  width: 100%;
  overflow-wrap: break-word;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TriggerCondition = styled('div')`
  display: flex;
  align-items: center;
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;
