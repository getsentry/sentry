import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import type {SelectValue} from '@sentry/scraps/select';

import {BarChart} from 'sentry/components/charts/barChart';
import {LoadingPanel} from 'sentry/components/charts/loadingPanel';
import {OptionSelector} from 'sentry/components/charts/optionSelector';
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
import {Panel} from 'sentry/components/panels/panel';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/explore/releases/utils/sessionTerm';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {
  getANRRateText,
  isPlatformANRCompatible,
  isPlatformForegroundANRCompatible,
} from 'sentry/views/projectDetail/utils';

import ProjectBaseEventsChart from './charts/projectBaseEventsChart';
import ProjectBaseSessionsChart from './charts/projectBaseSessionsChart';
import {ProjectErrorsBasicChart} from './charts/projectErrorsBasicChart';

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
  chartId: string;
  chartIndex: number;
  hasSessions: boolean | null;
  hasTransactions: boolean;
  location: Location;
  organization: Organization;
  visibleCharts: string[];
  project?: Project;
  projectId?: string;
  query?: string;
};

export function ProjectCharts({
  chartId,
  chartIndex,
  hasSessions,
  hasTransactions,
  location,
  organization,
  visibleCharts,
  project,
  projectId,
  query,
}: Props) {
  const api = useApi();
  const theme = useTheme();
  const navigate = useNavigate();
  const [totalValues, setTotalValues] = useState<number | null>(null);

  const defaultDisplayModes = (() => {
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
  })();

  const otherActiveDisplayModes = visibleCharts
    .filter(visibleChartId => visibleChartId !== chartId)
    .map(urlKey => {
      return decodeScalar(
        location.query[urlKey],
        defaultDisplayModes[visibleCharts.indexOf(urlKey)]!
      );
    });

  const displayMode = (() => {
    const mode = decodeScalar(location.query[chartId]) || defaultDisplayModes[chartIndex];

    if (!Object.values(DisplayModes).includes(mode as DisplayModes)) {
      return defaultDisplayModes[chartIndex];
    }

    return mode;
  })();

  const displayModes = ((): Array<SelectValue<string>> => {
    const hasPerformance = organization.features.includes('performance-view');
    const noPerformanceTooltip = t(
      'This view is only available with Performance Monitoring.'
    );
    const noHealthTooltip = t('This view is only available with Release Health.');

    const options = [
      {
        value: DisplayModes.STABILITY,
        label: t('Crash Free Sessions'),
        disabled:
          otherActiveDisplayModes.includes(DisplayModes.STABILITY) || !hasSessions,
        tooltip: hasSessions ? undefined : noHealthTooltip,
      },
      {
        value: DisplayModes.STABILITY_USERS,
        label: t('Crash Free Users'),
        disabled:
          otherActiveDisplayModes.includes(DisplayModes.STABILITY_USERS) || !hasSessions,
        tooltip: hasSessions ? undefined : noHealthTooltip,
      },
      {
        value: DisplayModes.APDEX,
        label: t('Apdex'),
        disabled:
          otherActiveDisplayModes.includes(DisplayModes.APDEX) ||
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
          otherActiveDisplayModes.includes(DisplayModes.FAILURE_RATE) ||
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
          otherActiveDisplayModes.includes(DisplayModes.TPM) ||
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
        disabled: otherActiveDisplayModes.includes(DisplayModes.ERRORS),
      },
      {
        value: DisplayModes.SESSIONS,
        label: t('Number of Sessions'),
        disabled: otherActiveDisplayModes.includes(DisplayModes.SESSIONS) || !hasSessions,
        tooltip: hasSessions ? undefined : noHealthTooltip,
      },
      {
        value: DisplayModes.TRANSACTIONS,
        label: t('Number of Transactions'),
        disabled:
          otherActiveDisplayModes.includes(DisplayModes.TRANSACTIONS) ||
          !hasPerformance ||
          !hasTransactions,
        tooltip: hasPerformance && hasTransactions ? undefined : noPerformanceTooltip,
      },
    ];

    if (isPlatformANRCompatible(project?.platform)) {
      const anrRateOptions = [
        {
          value: DisplayModes.ANR_RATE,
          label: getANRRateText(project?.platform),
          disabled:
            otherActiveDisplayModes.includes(DisplayModes.ANR_RATE) || !hasSessions,
          tooltip: hasSessions ? undefined : noHealthTooltip,
        },
      ];

      if (isPlatformForegroundANRCompatible(project?.platform)) {
        anrRateOptions.push({
          value: DisplayModes.FOREGROUND_ANR_RATE,
          label: t('Foreground ANR Rate'),
          disabled:
            otherActiveDisplayModes.includes(DisplayModes.FOREGROUND_ANR_RATE) ||
            !hasSessions,
          tooltip: hasSessions ? undefined : noHealthTooltip,
        });
      }

      return [...anrRateOptions, ...options];
    }

    return options;
  })();

  const summaryHeading = (() => {
    switch (displayMode) {
      case DisplayModes.ERRORS:
        return t('Sample Count');
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
  })();

  const barChartInterval = (() => {
    const diffInMinutes = getDiffInMinutes({
      ...location.query,
      period: decodeScalar(location.query.statsPeriod),
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
  })();

  const handleDisplayModeChange = (value: string) => {
    trackAnalytics('project_detail.change_chart', {
      organization,
      metric: value,
      chart_index: chartIndex,
    });

    navigate({
      pathname: location.pathname,
      query: {...location.query, [chartId]: value},
    });
  };

  // Keep this handler referentially stable. It is passed as `onTotalValuesChange`
  // to the chart request components, which compare props to decide whether to
  // refetch. Recreating it every render would trigger redundant session fetches.
  const handleTotalValuesChange = useCallback((value: number | null) => {
    setTotalValues(prev => (prev === value ? prev : value));
  }, []);

  const hasDiscover = organization.features.includes('discover-basic');
  const hasAnrRateFeature = isPlatformANRCompatible(project?.platform);
  const hasAnrForegroundRateFeature = isPlatformForegroundANRCompatible(
    project?.platform
  );

  return (
    <Panel>
      <ChartContainer>
        {defined(hasSessions) ? (
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
                location={location}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                colors={[
                  theme.chart.getColorPalette(0)[0],
                  theme.tokens.border.accent.moderate,
                ]}
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
                field={['failure_rate()']}
                api={api}
                location={location}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                colors={[
                  theme.tokens.dataviz.semantic.bad,
                  theme.tokens.border.accent.moderate,
                ]}
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
                field={['tpm()']}
                api={api}
                location={location}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                colors={[
                  theme.tokens.dataviz.semantic.meh,
                  theme.tokens.border.accent.moderate,
                ]}
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
                  field={['count()']}
                  api={api}
                  location={location}
                  organization={organization}
                  onTotalValuesChange={handleTotalValuesChange}
                  colors={[
                    theme.tokens.dataviz.semantic.accent,
                    theme.tokens.dataviz.semantic.neutral,
                  ]}
                  interval={barChartInterval}
                  chartComponent={BarChart}
                  disableReleases
                  dataset={DiscoverDatasets.ERRORS}
                />
              ) : (
                <ProjectErrorsBasicChart
                  projectId={projectId}
                  onTotalValuesChange={handleTotalValuesChange}
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
                field={['count()']}
                api={api}
                location={location}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                colors={[
                  theme.tokens.dataviz.semantic.neutral,
                  theme.tokens.border.accent.moderate,
                ]}
                interval={barChartInterval}
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
                onTotalValuesChange={handleTotalValuesChange}
                displayMode={displayMode}
                query={query}
              />
            )}
            {hasAnrRateFeature && displayMode === DisplayModes.ANR_RATE && (
              <ProjectBaseSessionsChart
                title={getANRRateText(project?.platform)}
                help={getSessionTermDescription(
                  SessionTerm.ANR_RATE,
                  project?.platform || null
                )}
                api={api}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                displayMode={displayMode}
                query={query}
              />
            )}
            {hasAnrForegroundRateFeature &&
              displayMode === DisplayModes.FOREGROUND_ANR_RATE && (
                <ProjectBaseSessionsChart
                  title={t('Foreground ANR Rate')}
                  help={getSessionTermDescription(SessionTerm.FOREGROUND_ANR_RATE, null)}
                  api={api}
                  organization={organization}
                  onTotalValuesChange={handleTotalValuesChange}
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
                onTotalValuesChange={handleTotalValuesChange}
                displayMode={displayMode}
                query={query}
              />
            )}
            {displayMode === DisplayModes.SESSIONS && (
              <ProjectBaseSessionsChart
                title={t('Number of Sessions')}
                api={api}
                organization={organization}
                onTotalValuesChange={handleTotalValuesChange}
                displayMode={displayMode}
                disablePrevious
                query={query}
              />
            )}
          </Fragment>
        ) : (
          <LoadingPanel />
        )}
      </ChartContainer>
      <ChartControls>
        {/* if hasSessions is not yet defined, it means that request is still in progress and we can't decide what default chart to show */}
        {defined(hasSessions) ? (
          <Fragment>
            <InlineContainer>
              <SectionHeading>{summaryHeading}</SectionHeading>
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
                options={displayModes}
                onChange={handleDisplayModeChange}
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
