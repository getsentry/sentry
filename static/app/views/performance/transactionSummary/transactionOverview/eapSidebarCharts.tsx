import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {getMeasurementSlug} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {FieldKind, WebVital} from 'sentry/utils/fields';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {usePrebuiltDashboardUrl} from 'sentry/views/dashboards/utils/usePrebuiltDashboardUrl';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {
  VitalState,
  vitalStateIcons,
  webVitalMeh,
  webVitalPoor,
} from 'sentry/views/performance/vitalDetail/utils';

const REFERRER = 'eap-sidebar-charts';

type Props = {
  hasWebVitals: boolean;
  transactionName: string;
};

export function EAPSidebarCharts({transactionName, hasWebVitals}: Props) {
  return (
    <Stack gap="md">
      {hasWebVitals && <WebVitalsWidget transactionName={transactionName} />}
      <FailureRateWidget transactionName={transactionName} />
    </Stack>
  );
}

function WebVitalsWidget({transactionName}: {transactionName: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );

  const search = new MutableSearch('');
  search.addFilterValue(SpanFields.TRANSACTION, transactionName);
  const filterValue = search.formatString();

  const dashboardUrl = usePrebuiltDashboardUrl(PrebuiltDashboardId.WEB_VITALS_SUMMARY, {
    filters: {
      globalFilter: [
        {
          dataset: WidgetType.SPANS,
          tag: {
            key: SpanFields.TRANSACTION,
            name: SpanFields.TRANSACTION,
            kind: FieldKind.TAG,
          },
          value: filterValue,
        },
      ],
    },
  });

  const transactionSearch = new MutableSearch('');
  transactionSearch.addFilterValue('transaction', transactionName);
  transactionSearch.addFilterValue('is_transaction', 'true');

  const {
    data: vitalsData,
    isPending,
    isError,
  } = useSpans(
    {
      search: transactionSearch,
      fields: WEB_VITALS.map(v => `p75(${v})` as const),
      pageFilters: selection,
    },
    REFERRER
  );

  if (isPending || isError) {
    return (
      <Widget
        Title={<SideBarWidgetTitle>{t('Web Vitals')}</SideBarWidgetTitle>}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        borderless
      />
    );
  }

  const row = vitalsData[0];

  return (
    <Widget
      Title={<SideBarWidgetTitle>{t('Web Vitals')}</SideBarWidgetTitle>}
      Actions={
        <Widget.WidgetToolbar>
          {hasPrebuiltDashboards && dashboardUrl && (
            <LinkButton to={dashboardUrl} size="sm">
              {t('View Details')}
            </LinkButton>
          )}
        </Widget.WidgetToolbar>
      }
      Visualization={
        <Stack gap="md" padding="md">
          {WEB_VITALS.map(vital => {
            const value = row?.[`p75(${vital})`];
            const slug = getMeasurementSlug(vital);
            const label = slug ? slug.toUpperCase() : vital;

            if (value === null || value === undefined || !Number.isFinite(value)) {
              return (
                <Flex key={vital} justify="between" align="center">
                  <Text variant="muted">{label}</Text>
                  <Text variant="muted">{'\u2014'}</Text>
                </Flex>
              );
            }

            const state = getVitalState(vital, value);

            return (
              <Flex key={vital} justify="between" align="center">
                <Flex align="center" gap="xs">
                  <Tooltip title={getThresholdTooltip(vital)}>
                    {vitalStateIcons[state]}
                  </Tooltip>
                  <Text>{label}</Text>
                </Flex>
                <Text>{formatVitalValue(vital, value)}</Text>
              </Flex>
            );
          })}
        </Stack>
      }
      borderless
    />
  );
}

const WEB_VITALS = [
  WebVital.FCP,
  WebVital.LCP,
  WebVital.CLS,
  WebVital.INP,
  WebVital.TTFB,
] as const;

function getVitalState(vital: (typeof WEB_VITALS)[number], value: number): VitalState {
  if (value > webVitalPoor[vital]) {
    return VitalState.POOR;
  }
  if (value > webVitalMeh[vital]) {
    return VitalState.MEH;
  }
  return VitalState.GOOD;
}

function formatVitalValue(
  vital: (typeof WEB_VITALS)[number],
  value: number,
  decimalPlaces?: number
): string {
  decimalPlaces = decimalPlaces === undefined ? 2 : decimalPlaces;
  if (vital === WebVital.CLS) {
    return value.toFixed(2);
  }
  // Time-based vitals are in milliseconds, getDuration expects seconds
  return getDuration(value / 1000, decimalPlaces, true);
}

function getThresholdTooltip(vital: (typeof WEB_VITALS)[number]): React.ReactNode {
  const mehThreshold = webVitalMeh[vital];
  const poorThreshold = webVitalPoor[vital];
  const formatThreshold = (v: number) => formatVitalValue(vital, v, 0);

  return (
    <Stack gap="xs">
      <Flex align="center" gap="xs">
        {vitalStateIcons[VitalState.GOOD]}
        <Text>{t('Good: ≤ %s', formatThreshold(mehThreshold))}</Text>
      </Flex>
      <Flex align="center" gap="xs">
        {vitalStateIcons[VitalState.MEH]}
        <Text>
          {t(
            'Meh: %s – %s',
            formatThreshold(mehThreshold),
            formatThreshold(poorThreshold)
          )}
        </Text>
      </Flex>
      <Flex align="center" gap="xs">
        {vitalStateIcons[VitalState.POOR]}
        <Text>{t('Poor: > %s', formatThreshold(poorThreshold))}</Text>
      </Flex>
    </Stack>
  );
}

type FailureRateWidgetProps = {
  transactionName: string;
};

function FailureRateWidget({transactionName}: FailureRateWidgetProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();

  const transactionSearch = new MutableSearch('');
  transactionSearch.addFilterValue('transaction', transactionName);
  transactionSearch.addFilterValue('is_transaction', 'true');

  const {
    data: failureRateSeriesData,
    isPending: isFailureRateSeriesPending,
    isError: isFailureRateSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: transactionSearch.copy(),
      yAxis: ['failure_rate()'],
    },
    REFERRER
  );

  const {
    data: failureRateValue,
    isPending: isFailureRateValuePending,
    isError: isFailureRateValueError,
  } = useSpans(
    {
      search: transactionSearch.copy(),
      fields: ['failure_rate()'],
      pageFilters: selection,
    },
    REFERRER
  );

  const getFailureRateBadge = () => {
    if (isFailureRateValuePending || isFailureRateValueError) {
      return null;
    }

    return (
      <Tag key="failure-rate-value" variant="danger">
        {formatPercentage(failureRateValue[0]?.['failure_rate()'] ?? 0)}
      </Tag>
    );
  };

  if (isFailureRateSeriesPending || isFailureRateSeriesError) {
    return (
      <Widget
        Title={<SideBarWidgetTitle>{t('Failure Rate')}</SideBarWidgetTitle>}
        TitleBadges={getFailureRateBadge()}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        borderless
      />
    );
  }

  const plottables = failureRateSeriesData.timeSeries.map(
    ts => new Line(ts, {color: theme.colors.red400})
  );

  return (
    <Widget
      Title={<SideBarWidgetTitle>{t('Failure Rate')}</SideBarWidgetTitle>}
      TitleBadges={getFailureRateBadge()}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription
            title={t('Failure Rate')}
            description={getTermHelp(organization, PerformanceTerm.FAILURE_RATE)}
          />
        </Widget.WidgetToolbar>
      }
      Visualization={<TimeSeriesWidgetVisualization plottables={plottables} />}
      height={200}
      borderless
    />
  );
}

const SideBarWidgetTitle = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
