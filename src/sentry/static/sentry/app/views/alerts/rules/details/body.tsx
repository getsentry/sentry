import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import EventsRequest from 'app/components/charts/eventsRequest';
import {SectionHeading} from 'app/components/charts/styles';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import SeenByList from 'app/components/seenByList';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, SelectValue} from 'app/types';
import {defined} from 'app/utils';
import Projects from 'app/utils/projects';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/settings/incidentRules/constants';
import {makeDefaultCta} from 'app/views/settings/incidentRules/presets';
import {AlertRuleThresholdType, TimePeriod} from 'app/views/settings/incidentRules/types';

import Activity from '../../details/activity';
import {
  AlertRuleStatus,
  Incident,
  IncidentStats,
  IncidentStatus,
  IncidentStatusMethod,
} from '../../types';
import {DATA_SOURCE_LABELS, getIncidentMetricPreset} from '../../utils';

import MetricChart from './metricChart';

type Props = {
  api: Client;
  incident?: Incident;
  stats?: IncidentStats;
  organization: Organization;
  location: Location;
} & RouteComponentProps<{orgId: string}, {}>;

const TIME_OPTIONS: SelectValue<string>[] = [
  {label: t('6 hours'), value: TimePeriod.SIX_HOURS},
  {label: t('24 hours'), value: TimePeriod.ONE_DAY},
  {label: t('3 days'), value: TimePeriod.THREE_DAYS},
  {label: t('7 days'), value: TimePeriod.SEVEN_DAYS},
];

export default class DetailsBody extends React.Component<Props> {
  get metricPreset() {
    const {incident} = this.props;
    return incident ? getIncidentMetricPreset(incident) : undefined;
  }

  /**
   * Return a string describing the threshold based on the threshold and the type
   */
  getThresholdText(
    value: number | '' | null | undefined,
    thresholdType: AlertRuleThresholdType,
    isAlert: boolean = false
  ) {
    if (!defined(value)) {
      return '';
    }

    const isAbove = thresholdType === AlertRuleThresholdType.ABOVE;
    const direction = isAbove === isAlert ? '>' : '<';

    return `${direction} ${value}`;
  }

  getTimePeriod() {
    const {location} = this.props;

    const timePeriod = location.query.period ?? TimePeriod.ONE_DAY;
    return TIME_OPTIONS.find(item => item.value === timePeriod) ?? TIME_OPTIONS[1];
  }

  handleTimePeriodChange = (value: string) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        period: value,
      },
    });
  };

  renderRuleDetails() {
    const {incident} = this.props;

    if (incident === undefined) {
      return <Placeholder height="200px" />;
    }

    const criticalTrigger = incident?.alertRule.triggers.find(
      ({label}) => label === 'critical'
    );
    const warningTrigger = incident?.alertRule.triggers.find(
      ({label}) => label === 'warning'
    );

    return (
      <RuleDetails>
        <span>{t('Data Source')}</span>
        <span>{DATA_SOURCE_LABELS[incident.alertRule?.dataset]}</span>

        <span>{t('Metric')}</span>
        <span>{incident.alertRule?.aggregate}</span>

        <span>{t('Time Window')}</span>
        <span>
          {incident && <Duration seconds={incident.alertRule.timeWindow * 60} />}
        </span>

        {incident.alertRule?.query && (
          <React.Fragment>
            <span>{t('Filter')}</span>
            <span title={incident.alertRule?.query}>{incident.alertRule?.query}</span>
          </React.Fragment>
        )}

        <span>{t('Critical Trigger')}</span>
        <span>
          {this.getThresholdText(
            criticalTrigger?.alertThreshold,
            incident.alertRule?.thresholdType,
            true
          )}
        </span>

        {defined(warningTrigger) && (
          <React.Fragment>
            <span>{t('Warning Trigger')}</span>
            <span>
              {this.getThresholdText(
                warningTrigger?.alertThreshold,
                incident.alertRule?.thresholdType,
                true
              )}
            </span>
          </React.Fragment>
        )}

        {defined(incident.alertRule?.resolveThreshold) && (
          <React.Fragment>
            <span>{t('Resolution')}</span>
            <span>
              {this.getThresholdText(
                incident.alertRule?.resolveThreshold,
                incident.alertRule?.thresholdType
              )}
            </span>
          </React.Fragment>
        )}
      </RuleDetails>
    );
  }

  renderChartHeader() {
    const {incident} = this.props;
    const alertRule = incident?.alertRule;

    return (
      <ChartHeader>
        <div>
          {this.metricPreset?.name ?? t('Custom metric')}
          <ChartParameters>
            {tct('Metric: [metric] over [window]', {
              metric: <code>{alertRule?.aggregate ?? '\u2026'}</code>,
              window: (
                <code>
                  {incident ? (
                    <Duration seconds={incident.alertRule.timeWindow * 60} />
                  ) : (
                    '\u2026'
                  )}
                </code>
              ),
            })}
            {(alertRule?.query || incident?.alertRule?.dataset) &&
              tct('Filter: [datasetType] [filter]', {
                datasetType: incident?.alertRule?.dataset && (
                  <code>{DATASET_EVENT_TYPE_FILTERS[incident.alertRule.dataset]}</code>
                ),
                filter: alertRule?.query && <code>{alertRule.query}</code>,
              })}
          </ChartParameters>
        </div>
      </ChartHeader>
    );
  }

  renderChartActions() {
    const {incident, params, stats} = this.props;

    return (
      // Currently only one button in pannel, hide panel if not available
      <Feature features={['discover-basic']}>
        <ChartActions>
          <Projects slugs={incident?.projects} orgId={params.orgId}>
            {({initiallyLoaded, fetching, projects}) => {
              const preset = this.metricPreset;
              const ctaOpts = {
                orgSlug: params.orgId,
                projects: (initiallyLoaded ? projects : []) as Project[],
                incident,
                stats,
              };

              const {buttonText, ...props} = preset
                ? preset.makeCtaParams(ctaOpts)
                : makeDefaultCta(ctaOpts);

              return (
                <Button
                  size="small"
                  priority="primary"
                  disabled={!incident || fetching || !initiallyLoaded}
                  {...props}
                >
                  {buttonText}
                </Button>
              );
            }}
          </Projects>
        </ChartActions>
      </Feature>
    );
  }

  render() {
    const {api, params, incident, organization} = this.props;
    const {query, environment, aggregate, projects: projectSlugs} =
      incident?.alertRule ?? {};
    const timePeriod = this.getTimePeriod();

    return (
      <Layout.Body>
        <Layout.Main>
          {incident &&
            incident.status === IncidentStatus.CLOSED &&
            incident.statusMethod === IncidentStatusMethod.RULE_UPDATED && (
              <AlertWrapper>
                <Alert type="warning" icon={<IconWarning size="sm" />}>
                  {t(
                    'This alert has been auto-resolved because the rule that triggered it has been modified or deleted'
                  )}
                </Alert>
              </AlertWrapper>
            )}
          <StyledDropdownControl
            buttonProps={{prefix: t('Display')}}
            label={timePeriod.label}
          >
            {TIME_OPTIONS.map(({label, value}) => (
              <DropdownItem
                key={value}
                eventKey={value}
                onSelect={this.handleTimePeriodChange}
              >
                {label}
              </DropdownItem>
            ))}
          </StyledDropdownControl>
          <ChartPanel>
            <PanelBody withPadding>
              {this.renderChartHeader()}
              <Projects orgId={organization.id} slugs={projectSlugs}>
                {({initiallyLoaded, projects}) => {
                  return initiallyLoaded && incident && incident.alertRule ? (
                    <EventsRequest
                      api={api}
                      organization={organization}
                      query={query}
                      environment={environment ? [environment] : undefined}
                      project={(projects as Project[]).map(project => Number(project.id))}
                      // TODO(davidenwang): allow interval to be changed for larger time periods
                      interval="5m"
                      period={timePeriod.value}
                      yAxis={aggregate}
                      includePrevious={false}
                      currentSeriesName={aggregate}
                    >
                      {({loading, timeseriesData}) =>
                        !loading && timeseriesData ? (
                          <MetricChart data={timeseriesData} />
                        ) : (
                          <Placeholder height="200px" />
                        )
                      }
                    </EventsRequest>
                  ) : (
                    <Placeholder height="200px" />
                  );
                }}
              </Projects>
            </PanelBody>
            {this.renderChartActions()}
          </ChartPanel>
          <DetailWrapper>
            <ActivityWrapper>
              <StyledNavTabs underlined>
                <li className="active">
                  <Link to="">{t('Activity')}</Link>
                </li>

                <SeenByTab>
                  {incident && (
                    <StyledSeenByList
                      iconPosition="right"
                      seenBy={incident.seenBy}
                      iconTooltip={t('People who have viewed this alert')}
                    />
                  )}
                </SeenByTab>
              </StyledNavTabs>
              <Activity
                incident={incident}
                params={params}
                incidentStatus={!!incident ? incident.status : null}
              />
            </ActivityWrapper>
          </DetailWrapper>
        </Layout.Main>
        <Layout.Side>
          <SidebarHeading>
            <span>{t('Alert Rule')}</span>
            {incident?.alertRule?.status !== AlertRuleStatus.SNAPSHOT && (
              <SideHeaderLink
                disabled={!!incident?.id}
                to={
                  incident?.id
                    ? {
                        pathname: `/organizations/${params.orgId}/alerts/metric-rules/${incident?.projects[0]}/${incident?.alertRule?.id}/`,
                      }
                    : ''
                }
              >
                {t('View Alert Rule')}
              </SideHeaderLink>
            )}
          </SidebarHeading>
          {this.renderRuleDetails()}
        </Layout.Side>
      </Layout.Body>
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
`;

const SidebarHeading = styled(SectionHeading)`
  display: flex;
  justify-content: space-between;
`;

const SideHeaderLink = styled(Link)`
  font-weight: normal;
`;

const ChartPanel = styled(Panel)``;

const StyledDropdownControl = styled(DropdownControl)`
  margin-bottom: ${space(2)};
  margin-right: ${space(1)};
`;

const ChartHeader = styled('header')`
  margin-bottom: ${space(1)};
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)};
`;

const ChartParameters = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-gap: ${space(4)};
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

const AlertWrapper = styled('div')`
  padding: ${space(2)} ${space(4)} 0;
`;

const StyledNavTabs = styled(NavTabs)`
  display: flex;
`;

const SeenByTab = styled('li')`
  flex: 1;
  margin-left: ${space(2)};
  margin-right: 0;

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
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
