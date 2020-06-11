import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Project} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {toTitleCase, defined} from 'app/utils';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import Duration from 'app/components/duration';
import Feature from 'app/components/acl/feature';
import Link from 'app/components/links/link';
import NavTabs from 'app/components/navTabs';
import Placeholder from 'app/components/placeholder';
import SeenByList from 'app/components/seenByList';
import {IconWarning} from 'app/icons';
import {SectionHeading} from 'app/components/charts/styles';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Button from 'app/components/button';
import {AlertRuleThresholdType, Trigger} from 'app/views/settings/incidentRules/types';
import {makeDefaultCta} from 'app/views/settings/incidentRules/presets';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/settings/incidentRules/constants';

import Activity from './activity';
import Chart from './chart';
import {
  Incident,
  IncidentStats,
  AlertRuleStatus,
  IncidentStatus,
  IncidentStatusMethod,
} from '../types';
import {getIncidentMetricPreset} from '../utils';

type Props = {
  incident?: Incident;
  stats?: IncidentStats;
} & RouteComponentProps<{alertId: string; orgId: string}, {}>;

export default class DetailsBody extends React.Component<Props> {
  get metricPreset() {
    const {incident} = this.props;
    return incident ? getIncidentMetricPreset(incident) : undefined;
  }

  /**
   * Return a string describing the threshold based on the threshold and the type
   */
  getThresholdText(
    trigger: Trigger | undefined,
    key: 'alertThreshold' | 'resolveThreshold'
  ) {
    if (!trigger || typeof trigger[key] !== 'number') {
      return '';
    }

    const isAbove = trigger.thresholdType === AlertRuleThresholdType.ABOVE;
    const isAlert = key === 'alertThreshold';
    const direction = isAbove === isAlert ? '>' : '<';

    return `${direction} ${trigger[key]}`;
  }

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
        <span>{t(toTitleCase(incident.alertRule?.dataset))}</span>

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
        <span>{this.getThresholdText(criticalTrigger, 'alertThreshold')}</span>

        {defined(criticalTrigger?.resolveThreshold) && (
          <React.Fragment>
            <span>{t('Critical Resolution')}</span>
            <span>{this.getThresholdText(criticalTrigger, 'resolveThreshold')}</span>
          </React.Fragment>
        )}

        {defined(warningTrigger) && (
          <React.Fragment>
            <span>{t('Warning Trigger')}</span>
            <span>{this.getThresholdText(warningTrigger, 'alertThreshold')}</span>

            {defined(warningTrigger?.resolveThreshold) && (
              <React.Fragment>
                <span>{t('Warning Resolution')}</span>
                <span>{this.getThresholdText(warningTrigger, 'resolveThreshold')}</span>
              </React.Fragment>
            )}
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
    const {params, incident, stats} = this.props;

    return (
      <StyledPageContent>
        <Main>
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
          <PageContent>
            <ChartPanel>
              <PanelBody withPadding>
                {this.renderChartHeader()}
                {incident && stats ? (
                  <Chart
                    triggers={incident.alertRule.triggers}
                    aggregate={incident.alertRule.aggregate}
                    data={stats.eventStats.data}
                    detected={incident.dateDetected}
                    closed={incident.dateClosed || undefined}
                  />
                ) : (
                  <Placeholder height="200px" />
                )}
              </PanelBody>
              {this.renderChartActions()}
            </ChartPanel>
          </PageContent>
          <DetailWrapper>
            <ActivityPageContent>
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
            </ActivityPageContent>
            <Sidebar>
              <SidebarHeading>
                <span>{t('Alert Rule')}</span>
                {incident?.alertRule?.status !== AlertRuleStatus.SNAPSHOT && (
                  <SideHeaderLink
                    to={{
                      pathname: `/settings/${params.orgId}/projects/${incident?.projects[0]}/alerts/metric-rules/${incident?.alertRule?.id}/`,
                    }}
                  >
                    {t('View Alert Rule')}
                  </SideHeaderLink>
                )}
              </SidebarHeading>
              {this.renderRuleDetails()}
            </Sidebar>
          </DetailWrapper>
        </Main>
      </StyledPageContent>
    );
  }
}

const Main = styled('div')`
  background-color: ${p => p.theme.white};
  padding-top: ${space(3)};
  flex-grow: 1;
`;

const DetailWrapper = styled('div')`
  display: flex;
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column-reverse;
  }
`;

const ActivityPageContent = styled(PageContent)`
  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    margin-bottom: 0;
  }
`;

const Sidebar = styled(PageContent)`
  width: 400px;
  flex: none;
  padding-top: ${space(3)};

  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
    padding-top: ${space(3)};
    margin-bottom: 0;
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

const SidebarHeading = styled(SectionHeading)`
  display: flex;
  justify-content: space-between;
`;

const SideHeaderLink = styled(Link)`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  grid-gap: ${space(0.5)};
  font-weight: normal;
`;

const StyledPageContent = styled(PageContent)`
  padding: 0;
  flex-direction: column;
`;

const ChartPanel = styled(Panel)``;

const ChartHeader = styled('header')`
  margin-bottom: ${space(1)};
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)};
`;

const ChartParameters = styled('div')`
  color: ${p => p.theme.gray600};
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
    background: ${p => p.theme.borderLight};
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
    background-color: ${p => p.theme.gray100};
  }
`;
