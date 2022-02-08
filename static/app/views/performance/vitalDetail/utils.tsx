import * as React from 'react';
import {Location, Query} from 'history';

import MarkLine from 'sentry/components/charts/components/markLine';
import {getSeriesSelection} from 'sentry/components/charts/utils';
import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {getAggregateAlias, WebVital} from 'sentry/utils/discover/fields';
import {TransactionMetric} from 'sentry/utils/metrics/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {Color, Theme} from 'sentry/utils/theme';

export function generateVitalDetailRoute({orgSlug}: {orgSlug: string}): string {
  return `/organizations/${orgSlug}/performance/vitaldetail/`;
}

export const webVitalPoor = {
  [WebVital.FP]: 3000,
  [WebVital.FCP]: 3000,
  [WebVital.LCP]: 4000,
  [WebVital.FID]: 300,
  [WebVital.CLS]: 0.25,
};

export const webVitalMeh = {
  [WebVital.FP]: 1000,
  [WebVital.FCP]: 1000,
  [WebVital.LCP]: 2500,
  [WebVital.FID]: 100,
  [WebVital.CLS]: 0.1,
};

export enum VitalState {
  POOR = 'Poor',
  MEH = 'Meh',
  GOOD = 'Good',
}

export const vitalStateColors: Record<VitalState, Color> = {
  [VitalState.POOR]: 'red300',
  [VitalState.MEH]: 'yellow300',
  [VitalState.GOOD]: 'green300',
};

export const vitalStateIcons: Record<VitalState, React.ReactNode> = {
  [VitalState.POOR]: <IconSad color={vitalStateColors[VitalState.POOR]} />,
  [VitalState.MEH]: <IconMeh color={vitalStateColors[VitalState.MEH]} />,
  [VitalState.GOOD]: <IconHappy color={vitalStateColors[VitalState.GOOD]} />,
};

export function vitalDetailRouteWithQuery({
  orgSlug,
  vitalName,
  projectID,
  query,
}: {
  orgSlug: string;
  query: Query;
  vitalName: string;
  projectID?: string | string[];
}) {
  const pathname = generateVitalDetailRoute({
    orgSlug,
  });

  return {
    pathname,
    query: {
      vitalName,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}

export function vitalNameFromLocation(location: Location): WebVital {
  const _vitalName = decodeScalar(location.query.vitalName);

  const vitalName = Object.values(WebVital).find(v => v === _vitalName);

  if (vitalName) {
    return vitalName;
  }
  return WebVital.LCP;
}

export function getVitalDetailTablePoorStatusFunction(vitalName: WebVital): string {
  const vitalThreshold = webVitalPoor[vitalName];
  const statusFunction = `compare_numeric_aggregate(${getAggregateAlias(
    `p75(${vitalName})`
  )},greater,${vitalThreshold})`;
  return statusFunction;
}

export function getVitalDetailTableMehStatusFunction(vitalName: WebVital): string {
  const vitalThreshold = webVitalMeh[vitalName];
  const statusFunction = `compare_numeric_aggregate(${getAggregateAlias(
    `p75(${vitalName})`
  )},greater,${vitalThreshold})`;
  return statusFunction;
}

export const vitalMap: Partial<Record<WebVital, string>> = {
  [WebVital.FCP]: 'First Contentful Paint',
  [WebVital.CLS]: 'Cumulative Layout Shift',
  [WebVital.FID]: 'First Input Delay',
  [WebVital.LCP]: 'Largest Contentful Paint',
};

export const vitalChartTitleMap = vitalMap;

export const vitalDescription: Partial<Record<WebVital, string>> = {
  [WebVital.FCP]:
    'First Contentful Paint (FCP) measures the amount of time the first content takes to render in the viewport. Like FP, this could also show up in any form from the document object model (DOM), such as images, SVGs, or text blocks. At the moment, there is support for FCP in the following browsers:',
  [WebVital.CLS]:
    'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. Imagine navigating to an article and trying to click a link before the page finishes loading. Before your cursor even gets there, the link may have shifted down due to an image rendering. Rather than using duration for this Web Vital, the CLS score represents the degree of disruptive and visually unstable shifts. At the moment, there is support for CLS in the following browsers:',
  [WebVital.FID]:
    'First Input Delay (FID) measures the response time when the user tries to interact with the viewport. Actions maybe include clicking a button, link or other custom Javascript controller. It is key in helping the user determine if a page is usable or not. At the moment, there is support for FID in the following browsers:',
  [WebVital.LCP]:
    'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. This may be in any form from the document object model (DOM), such as images, SVGs, or text blocks. It’s the largest pixel area in the viewport, thus most visually defining. LCP helps developers understand how long it takes to see the main content on the page. At the moment, there is support for LCP in the following browsers:',
};

export const vitalAbbreviations: Partial<Record<WebVital, string>> = {
  [WebVital.FCP]: 'FCP',
  [WebVital.CLS]: 'CLS',
  [WebVital.FID]: 'FID',
  [WebVital.LCP]: 'LCP',
};

export function getMaxOfSeries(series: Series[]) {
  let max = -Infinity;
  for (const {data} of series) {
    for (const point of data) {
      max = Math.max(max, point.value);
    }
  }
  return max;
}

export const vitalToMetricsField: Record<string, TransactionMetric> = {
  [WebVital.LCP]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP,
  [WebVital.FCP]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP,
  [WebVital.FID]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID,
  [WebVital.CLS]: TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS,
};

export const vitalSupportedBrowsers: Partial<Record<WebVital, Browser[]>> = {
  [WebVital.LCP]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
  [WebVital.FID]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
    Browser.IE,
  ],
  [WebVital.CLS]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
  [WebVital.FP]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
  [WebVital.FCP]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
  ],
  [WebVital.TTFB]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
    Browser.IE,
  ],
};

export function getVitalChartDefinitions({
  theme,
  location,
  vital,
  yAxis,
}: {
  location: Location;
  theme: Theme;
  vital: string;
  yAxis: string;
}) {
  const utc = decodeScalar(location.query.utc) !== 'false';

  const vitalPoor = webVitalPoor[vital];
  const vitalMeh = webVitalMeh[vital];

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const chartOptions = {
    grid: {
      left: '5px',
      right: '10px',
      top: '35px',
      bottom: '0px',
    },
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (value: number, seriesName?: string) =>
        tooltipFormatter(value, vital === WebVital.CLS ? seriesName : yAxis),
    },
    yAxis: {
      min: 0,
      max: vitalPoor,
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        // coerces the axis to be time based
        formatter: (value: number) => axisLabelFormatter(value, yAxis),
      },
    },
  };

  const markLines = [
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.red300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Poor'),
        },
        data: [
          {
            yAxis: vitalPoor,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.yellow300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Meh'),
        },
        data: [
          {
            yAxis: vitalMeh,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
  ];

  return {
    vitalPoor,
    vitalMeh,
    legend,
    chartOptions,
    markLines,
    utc,
  };
}
