import {Location, Query} from 'history';

import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {Series} from 'app/types/echarts';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

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

export const vitalStateColors = {
  [VitalState.POOR]: theme.red300,
  [VitalState.MEH]: theme.yellow300,
  [VitalState.GOOD]: theme.green300,
};

export const vitalStateIcons = {
  [VitalState.POOR]: IconFire,
  [VitalState.MEH]: IconWarning,
  [VitalState.GOOD]: IconCheckmark,
};

export function vitalDetailRouteWithQuery({
  orgSlug,
  vitalName,
  projectID,
  query,
}: {
  orgSlug: string;
  vitalName: string;
  query: Query;
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
  } else {
    return WebVital.LCP;
  }
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
    'First Contentful Paint (FCP) measures the amount of time the first content takes to render in the viewport. Like FP, this could also show up in any form from the document object model (DOM), such as images, SVGs, or text blocks.',
  [WebVital.CLS]:
    'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. Imagine navigating to an article and trying to click a link before the page finishes loading. Before your cursor even gets there, the link may have shifted down due to an image rendering. Rather than using duration for this Web Vital, the CLS score represents the degree of disruptive and visually unstable shifts.',
  [WebVital.FID]:
    'First Input Delay measures the response time when the user tries to interact with the viewport. Actions maybe include clicking a button, link or other custom Javascript controller. It is key in helping the user determine if a page is usable or not.',
  [WebVital.LCP]:
    'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. This may be in any form from the document object model (DOM), such as images, SVGs, or text blocks. It’s the largest pixel area in the viewport, thus most visually defining. LCP helps developers understand how long it takes to see the main content on the page.',
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
