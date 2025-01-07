import {Component, Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {BarChart} from 'sentry/components/charts/barChart';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {
  getDiffInMinutes,
  ONE_HOUR,
  ONE_WEEK,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {NOT_AVAILABLE_MESSAGES} from 'sentry/constants/notAvailableMessages';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import {isPlatformANRCompatible} from 'sentry/views/projectDetail/utils';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

import {getTermHelp, PerformanceTerm} from '../performance/data';

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
  STABILITY_USERS = 'crash_free_users',
  ANR_RATE = 'anr_rate',
  FOREGROUND_ANR_RATE = 'foreground_anr_rate',
  SESSIONS = 'sessions',
}

type Props = {
  api: Client;
  chartId: string;
  chartIndex: number;
  hasSessions: boolean | null;
  hasTransactions: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  theme: Theme;
  visibleCharts: string[];
  project?: Project;
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
    const {hasSessions, hasTransactions, project} = this.props;

    if (!hasSessions && !hasTransactions) {
      return [DisplayModes.ERRORS];
    }

    if (hasSessions && !hasTransactions) {
      if (isPlatformANRCompatible(project?.platform)) {
        return [DisplayModes.STABILITY, DisplayModes.ANR_RATE];
      }
      return [DisplayModes.STABILITY, DisplayModes.ERRORS];
    }

    if (!hasSessions && hasTransactions) {
      return [DisplayModes.FAILURE_RATE, DisplayModes.APDEX];
    }

    if (isPlatformANRCompatible(project?.platform)) {
      return [DisplayModes.STABILITY, DisplayModes.ANR_RATE];
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
          this.defaultDisplayModes[visibleCharts.findIndex(value => value === urlKey)]!
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
    const {organization, hasSessions, hasTransactions, project} = this.props;
    const hasPerformance = organization.features.includes('performance-view');
    const noPerformanceTooltip = NOT_AVAILABLE_MESSAGES.performance;
    const noHealthTooltip = NOT_AVAILABLE_MESSAGES.releaseHealth;

    const options = [
      {
        value: DisplayModes.STABILITY,
        label: t('Crash Free Sessions'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.STABILITY) || !hasSessions,
        tooltip: !hasSessions ? noHealthTooltip : undefined,
      },
      {
        value: DisplayModes.STABILITY_USERS,
        label: t('Crash Free Users'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.STABILITY_USERS) ||
          !hasSessions,
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
            ? getTermHelp(organization, PerformanceTerm.APDEX)
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
            ? getTermHelp(organization, PerformanceTerm.FAILURE_RATE)
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
            ? getTermHelp(organization, PerformanceTerm.TPM)
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

    if (isPlatformANRCompatible(project?.platform)) {
      return [
        {
          value: DisplayModes.ANR_RATE,
          label: t('ANR Rate'),
          disabled:
            this.otherActiveDisplayModes.includes(DisplayModes.ANR_RATE) || !hasSessions,
          tooltip: !hasSessions ? noHealthTooltip : undefined,
        },
        {
          value: DisplayModes.FOREGROUND_ANR_RATE,
          label: t('Foreground ANR Rate'),
          disabled:
            this.otherActiveDisplayModes.includes(DisplayModes.FOREGROUND_ANR_RATE) ||
            !hasSessions,
          tooltip: !hasSessions ? noHealthTooltip : undefined,
        },
        ...options,
      ];
    }

    return options;
  }

  get summaryHeading() {
    switch (this.displayMode) {
      case DisplayModes.ERRORS:
        return t('Total Errors');
      case DisplayModes.STABILITY:
      case DisplayModes.SESSIONS:
        return t('Total Sessions');
      case DisplayModes.STABILITY_USERS:
      case DisplayModes.ANR_RATE:
      case DisplayModes.FOREGROUND_ANR_RATE:
        return t('Total Users');
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
    trackAnalytics('project_detail.change_chart', {
      organization,
      metric: value,
      chart_index: chartIndex,
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
    const {
      api,
      router,
      location,
      organization,
      theme,
      projectId,
      hasSessions,
      query,
      project,
    } = this.props;
    const {totalValues} = this.state;
    const hasDiscover = organization.features.includes('discover-basic');
    const displayMode = this.displayMode;
    const hasAnrRateFeature = isPlatformANRCompatible(project?.platform);

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
                  help={getTermHelp(organization, PerformanceTerm.APDEX)}
                  query={new MutableSearch([
                    'event.type:transaction',
                    query ?? '',
                  ]).formatString()}
                  yAxis="apdex()"
                  field={['apdex()']}
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
                  help={getTermHelp(organization, PerformanceTerm.FAILURE_RATE)}
                  query={new MutableSearch([
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
                  help={getTermHelp(organization, PerformanceTerm.TPM)}
                  query={new MutableSearch([
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
                    query={new MutableSearch([
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
                    dataset={DiscoverDatasets.ERRORS}
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
                  query={new MutableSearch([
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
                  api={api}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  displayMode={displayMode}
                  query={query}
                />
              )}
              {hasAnrRateFeature && displayMode === DisplayModes.ANR_RATE && (
                <ProjectBaseSessionsChart
                  title={t('ANR Rate')}
                  help={getSessionTermDescription(SessionTerm.ANR_RATE, null)}
                  api={api}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  displayMode={displayMode}
                  query={query}
                />
              )}
              {hasAnrRateFeature && displayMode === DisplayModes.FOREGROUND_ANR_RATE && (
                <ProjectBaseSessionsChart
                  title={t('Foreground ANR Rate')}
                  help={getSessionTermDescription(SessionTerm.FOREGROUND_ANR_RATE, null)}
                  api={api}
                  organization={organization}
                  onTotalValuesChange={this.handleTotalValuesChange}
                  displayMode={displayMode}
                  query={query}
                />
              )}
              {displayMode === DisplayModes.STABILITY_USERS && (
                <ProjectBaseSessionsChart
                  title={t('Crash Free Users')}
                  help={getSessionTermDescription(SessionTerm.CRASH_FREE_USERS, null)}
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
                  selected={displayMode!}
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
