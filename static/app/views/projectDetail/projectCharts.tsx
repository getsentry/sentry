import {Component, Fragment} from 'react';
import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
import {withTheme} from '@emotion/react';
import {Location} from 'history';

import {Client} from 'app/api';
import BarChart from 'app/components/charts/barChart';
import LoadingPanel from 'app/components/charts/loadingPanel';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {
  getDiffInMinutes,
  ONE_HOUR,
  ONE_WEEK,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'app/components/charts/utils';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import CHART_PALETTE from 'app/constants/chartPalette';
import NOT_AVAILABLE_MESSAGES from 'app/constants/notAvailableMessages';
import {t} from 'app/locale';
import {Organization, SelectValue} from 'app/types';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'app/views/releases/utils/sessionTerm';

import {getTermHelp, PERFORMANCE_TERM} from '../performance/data';

import ProjectBaseEventsChart from './charts/projectBaseEventsChart';
import ProjectBaseSessionsChart from './charts/projectBaseSessionsChart';
import ProjectErrorsBasicChart from './charts/projectErrorsBasicChart';

export enum DisplayModes {
  APDEX = 'apdex',
  FAILURE_RATE = 'failure_rate',
  TPM = 'tpm',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  STABILITY = 'crash_free',
  SESSIONS = 'sessions',
}

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
  chartId: string;
  chartIndex: number;
  theme: Theme;
  hasSessions: boolean | null;
  hasTransactions: boolean;
  visibleCharts: string[];
  projectId?: string;
  query?: string;
};

type State = {
  totalValues: number | null;
};

class ProjectCharts extends Component<Props, State> {
  state: State = {
    totalValues: null,
  };

  get defaultDisplayModes() {
    const {hasSessions, hasTransactions} = this.props;

    if (!hasSessions && !hasTransactions) {
      return [DisplayModes.ERRORS];
    }

    if (hasSessions && !hasTransactions) {
      return [DisplayModes.STABILITY, DisplayModes.ERRORS];
    }

    if (!hasSessions && hasTransactions) {
      return [DisplayModes.FAILURE_RATE, DisplayModes.APDEX];
    }

    return [DisplayModes.STABILITY, DisplayModes.APDEX];
  }

  get otherActiveDisplayModes() {
    const {location, visibleCharts, chartId} = this.props;

    return visibleCharts
      .filter(visibleChartId => visibleChartId !== chartId)
      .map(urlKey => {
        return decodeScalar(
          location.query[urlKey],
          this.defaultDisplayModes[visibleCharts.findIndex(value => value === urlKey)]
        );
      });
  }

  get displayMode() {
    const {location, chartId, chartIndex} = this.props;
    const displayMode =
      decodeScalar(location.query[chartId]) || this.defaultDisplayModes[chartIndex];

    if (!Object.values(DisplayModes).includes(displayMode as DisplayModes)) {
      return this.defaultDisplayModes[chartIndex];
    }

    return displayMode;
  }

  get displayModes(): SelectValue<string>[] {
    const {organization, hasSessions, hasTransactions} = this.props;
    const hasPerformance = organization.features.includes('performance-view');
    const noPerformanceTooltip = NOT_AVAILABLE_MESSAGES.performance;
    const noHealthTooltip = NOT_AVAILABLE_MESSAGES.releaseHealth;

    return [
      {
        value: DisplayModes.STABILITY,
        label: t('Crash Free Sessions'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.STABILITY) || !hasSessions,
        tooltip: !hasSessions ? noHealthTooltip : undefined,
      },
      {
        value: DisplayModes.APDEX,
        label: t('Apdex'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.APDEX) ||
          !hasPerformance ||
          !hasTransactions,
        tooltip:
          hasPerformance && hasTransactions
            ? getTermHelp(organization, PERFORMANCE_TERM.APDEX)
            : noPerformanceTooltip,
      },
      {
        value: DisplayModes.FAILURE_RATE,
        label: t('Failure Rate'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.FAILURE_RATE) ||
          !hasPerformance ||
          !hasTransactions,
        tooltip:
          hasPerformance && hasTransactions
            ? getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE)
            : noPerformanceTooltip,
      },
      {
        value: DisplayModes.TPM,
        label: t('Transactions Per Minute'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.TPM) ||
          !hasPerformance ||
          !hasTransactions,
        tooltip:
          hasPerformance && hasTransactions
            ? getTermHelp(organization, PERFORMANCE_TERM.TPM)
            : noPerformanceTooltip,
      },
      {
        value: DisplayModes.ERRORS,
        label: t('Number of Errors'),
        disabled: this.otherActiveDisplayModes.includes(DisplayModes.ERRORS),
      },
      {
        value: DisplayModes.SESSIONS,
        label: t('Number of Sessions'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.SESSIONS) || !hasSessions,
        tooltip: !hasSessions ? noHealthTooltip : undefined,
      },
      {
        value: DisplayModes.TRANSACTIONS,
        label: t('Number of Transactions'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.TRANSACTIONS) ||
          !hasPerformance ||
          !hasTransactions,
        tooltip: hasPerformance && hasTransactions ? undefined : noPerformanceTooltip,
      },
    ];
  }

  get summaryHeading() {
    switch (this.displayMode) {
      case DisplayModes.ERRORS:
        return t('Total Errors');
      case DisplayModes.STABILITY:
      case DisplayModes.SESSIONS:
        return t('Total Sessions');
      case DisplayModes.APDEX:
      case DisplayModes.FAILURE_RATE:
      case DisplayModes.TPM:
      case DisplayModes.TRANSACTIONS:
      default:
        return t('Total Transactions');
    }
  }

  get barChartInterval() {
    const {query} = this.props.location;

    const diffInMinutes = getDiffInMinutes({
      ...query,
      period: decodeScalar(query.statsPeriod),
    });

    if (diffInMinutes >= TWO_WEEKS) {
      return '1d';
    }

    if (diffInMinutes >= ONE_WEEK) {
      return '12h';
    }

    if (diffInMinutes > TWENTY_FOUR_HOURS) {
      return '6h';
    }

    if (diffInMinutes === TWENTY_FOUR_HOURS) {
      return '1h';
    }

    if (diffInMinutes <= ONE_HOUR) {
      return '1m';
    }

    return '15m';
  }

  handleDisplayModeChange = (value: string) => {
    const {location, chartId, chartIndex, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: `project_detail.change_chart${chartIndex + 1}`,
      eventName: `Project Detail: Change Chart #${chartIndex + 1}`,
      organization_id: parseInt(organization.id, 10),
      metric: value,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, [chartId]: value},
    });
  };

  handleTotalValuesChange = (value: number | null) => {
    if (value !== this.state.totalValues) {
      this.setState({totalValues: value});
    }
  };

  render() {
    const {api, router, location, organization, theme, projectId, hasSessions, query} =
      this.props;
    const {totalValues} = this.state;
    const hasDiscover = organization.features.includes('discover-basic');
    const displayMode = this.displayMode;

    let apdexYAxis: string;
    let apdexPerformanceTerm: PERFORMANCE_TERM;
    if (organization.features.includes('project-transaction-threshold')) {
      apdexPerformanceTerm = PERFORMANCE_TERM.APDEX_NEW;
      apdexYAxis = 'apdex()';
    } else {
      apdexPerformanceTerm = PERFORMANCE_TERM.APDEX;
      apdexYAxis = `apdex(${organization.apdexThreshold})`;
    }

    return (
      <Panel>
        <ChartContainer>
          {!defined(hasSessions) ? (
            <LoadingPanel />
          ) : (
            <Fragment>
              {displayMode === DisplayModes.APDEX && (
                <ProjectBaseEventsChart
                  title={t('Apdex')}
                  help={getTermHelp(organization, apdexPerformanceTerm)}
                  query={new QueryResults([
                    'event.type:transaction',
                    query ?? '',
                  ]).formatString()}
                  yAxis={apdexYAxis}
                  field={[apdexYAxis]}
                  api={api}
                  router={router}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  colors={[CHART_PALETTE[0][0], theme.purple200]}
                />
              )}
              {displayMode === DisplayModes.FAILURE_RATE && (
                <ProjectBaseEventsChart
                  title={t('Failure Rate')}
                  help={getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE)}
                  query={new QueryResults([
                    'event.type:transaction',
                    query ?? '',
                  ]).formatString()}
                  yAxis="failure_rate()"
                  field={[`failure_rate()`]}
                  api={api}
                  router={router}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  colors={[theme.red300, theme.purple200]}
                />
              )}
              {displayMode === DisplayModes.TPM && (
                <ProjectBaseEventsChart
                  title={t('Transactions Per Minute')}
                  help={getTermHelp(organization, PERFORMANCE_TERM.TPM)}
                  query={new QueryResults([
                    'event.type:transaction',
                    query ?? '',
                  ]).formatString()}
                  yAxis="tpm()"
                  field={[`tpm()`]}
                  api={api}
                  router={router}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  colors={[theme.yellow300, theme.purple200]}
                  disablePrevious
                />
              )}
              {displayMode === DisplayModes.ERRORS &&
                (hasDiscover ? (
                  <ProjectBaseEventsChart
                    title={t('Number of Errors')}
                    query={new QueryResults([
                      '!event.type:transaction',
                      query ?? '',
                    ]).formatString()}
                    yAxis="count()"
                    field={[`count()`]}
                    api={api}
                    router={router}
                    organization={organization}
                    onTotalValuesChange={this.handleTotalValuesChange}
                    colors={[theme.purple300, theme.purple200]}
                    interval={this.barChartInterval}
                    chartComponent={BarChart}
                    disableReleases
                  />
                ) : (
                  <ProjectErrorsBasicChart
                    organization={organization}
                    projectId={projectId}
                    location={location}
                    onTotalValuesChange={this.handleTotalValuesChange}
                  />
                ))}
              {displayMode === DisplayModes.TRANSACTIONS && (
                <ProjectBaseEventsChart
                  title={t('Number of Transactions')}
                  query={new QueryResults([
                    'event.type:transaction',
                    query ?? '',
                  ]).formatString()}
                  yAxis="count()"
                  field={[`count()`]}
                  api={api}
                  router={router}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  colors={[theme.gray200, theme.purple200]}
                  interval={this.barChartInterval}
                  chartComponent={BarChart}
                  disableReleases
                />
              )}
              {displayMode === DisplayModes.STABILITY && (
                <ProjectBaseSessionsChart
                  title={t('Crash Free Sessions')}
                  help={getSessionTermDescription(SessionTerm.STABILITY, null)}
                  router={router}
                  api={api}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  displayMode={displayMode}
                  query={query}
                />
              )}
              {displayMode === DisplayModes.SESSIONS && (
                <ProjectBaseSessionsChart
                  title={t('Number of Sessions')}
                  router={router}
                  api={api}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  displayMode={displayMode}
                  disablePrevious
                  query={query}
                />
              )}
            </Fragment>
          )}
        </ChartContainer>
        <ChartControls>
          {/* if hasSessions is not yet defined, it means that request is still in progress and we can't decide what default chart to show */}
          {defined(hasSessions) ? (
            <Fragment>
              <InlineContainer>
                <SectionHeading>{this.summaryHeading}</SectionHeading>
                <SectionValue>
                  {typeof totalValues === 'number'
                    ? totalValues.toLocaleString()
                    : '\u2014'}
                </SectionValue>
              </InlineContainer>
              <InlineContainer>
                <OptionSelector
                  title={t('Display')}
                  selected={displayMode}
                  options={this.displayModes}
                  onChange={this.handleDisplayModeChange}
                />
              </InlineContainer>
            </Fragment>
          ) : (
            <Placeholder height="34px" />
          )}
        </ChartControls>
      </Panel>
    );
  }
}

export default withApi(withTheme(ProjectCharts));
