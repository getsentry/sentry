import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import EventsRequest from 'app/components/charts/eventsRequest';
import {SectionHeading} from 'app/components/charts/styles';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import * as Layout from 'app/components/layouts/thirds';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, SelectValue} from 'app/types';
import {defined} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import Projects from 'app/utils/projects';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/settings/incidentRules/constants';
import {makeDefaultCta} from 'app/views/settings/incidentRules/incidentRulePresets';
import {
  AlertRuleThresholdType,
  Dataset,
  IncidentRule,
  TimePeriod,
  TimeWindow,
} from 'app/views/settings/incidentRules/types';

import {Incident} from '../../types';
import {DATA_SOURCE_LABELS, getIncidentRuleMetricPreset} from '../../utils';

import MetricChart from './metricChart';
import RelatedIssues from './relatedIssues';

type Props = {
  api: Client;
  rule?: IncidentRule;
  incidents?: Incident[];
  organization: Organization;
  location: Location;
} & RouteComponentProps<{orgId: string}, {}>;

const TIME_OPTIONS: SelectValue<string>[] = [
  {label: t('6 hours'), value: TimePeriod.SIX_HOURS},
  {label: t('24 hours'), value: TimePeriod.ONE_DAY},
  {label: t('3 days'), value: TimePeriod.THREE_DAYS},
  {label: t('7 days'), value: TimePeriod.SEVEN_DAYS},
];

const TIME_WINDOWS = {
  [TimePeriod.SIX_HOURS]: TimeWindow.ONE_HOUR * 6 * 60 * 1000,
  [TimePeriod.ONE_DAY]: TimeWindow.ONE_DAY * 60 * 1000,
  [TimePeriod.THREE_DAYS]: TimeWindow.ONE_DAY * 3 * 60 * 1000,
  [TimePeriod.SEVEN_DAYS]: TimeWindow.ONE_DAY * 7 * 60 * 1000,
};

export default class DetailsBody extends React.Component<Props> {
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

  getTimePeriod() {
    const {location} = this.props;
    const now = moment.utc();

    const timePeriod = location.query.period ?? TimePeriod.ONE_DAY;
    const timeOption =
      TIME_OPTIONS.find(item => item.value === timePeriod) ?? TIME_OPTIONS[1];

    return {
      ...timeOption,
      start: getUtcDateString(moment(now.diff(TIME_WINDOWS[timeOption.value]))),
      end: getUtcDateString(now),
    };
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

  renderChartActions(projects: Project[]) {
    const {rule, params} = this.props;
    const timePeriod = this.getTimePeriod();
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

    return (
      // Currently only one button in panel, hide panel if not available
      <Feature features={['discover-basic']}>
        <ChartActions>
          <Button size="small" priority="primary" disabled={!rule} {...props}>
            {buttonText}
          </Button>
        </ChartActions>
      </Feature>
    );
  }

  render() {
    const {
      api,
      rule,
      incidents,
      organization,
      params: {orgId},
    } = this.props;
    const {query, environment, aggregate, projects: projectSlugs} = rule ?? {};
    const timePeriod = this.getTimePeriod();

    return (
      <Projects orgId={orgId} slugs={projectSlugs}>
        {({initiallyLoaded, projects}) => {
          return initiallyLoaded && rule ? (
            <Layout.Body>
              <Layout.Main>
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
                    <ChartHeader>
                      {this.metricPreset?.name ?? t('Custom metric')}
                    </ChartHeader>
                    <EventsRequest
                      api={api}
                      organization={organization}
                      query={query}
                      environment={environment ? [environment] : undefined}
                      project={(projects as Project[]).map(project => Number(project.id))}
                      // TODO(davidenwang): allow interval to be changed for larger time periods
                      interval="60s"
                      period={timePeriod.value}
                      yAxis={aggregate}
                      includePrevious={false}
                      currentSeriesName={aggregate}
                    >
                      {({loading, timeseriesData}) =>
                        !loading && timeseriesData ? (
                          <MetricChart data={timeseriesData} incidents={incidents} />
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
                        filter={DATASET_EVENT_TYPE_FILTERS[rule.dataset]}
                      />
                    )}
                  </ActivityWrapper>
                </DetailWrapper>
              </Layout.Main>
              <Layout.Side>
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

const SidebarHeading = styled(SectionHeading)`
  display: flex;
  justify-content: space-between;
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
