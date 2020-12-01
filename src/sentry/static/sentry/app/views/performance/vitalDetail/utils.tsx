import {Location, Query} from 'history';

import {Series} from 'app/types/echarts';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';

import {WEB_VITAL_DETAILS} from '../transactionVitals/constants';

export function generateVitalDetailRoute({orgSlug}: {orgSlug: string}): string {
  return `/organizations/${orgSlug}/performance/vitaldetail/`;
}

export const vitalsThresholdFields = {
  [WebVital.FP]: 'count_at_least(measurements.fp, 3000)',
  [WebVital.FCP]: 'count_at_least(measurements.fcp, 3000)',
  [WebVital.LCP]: 'count_at_least(measurements.lcp, 4000)',
  [WebVital.FID]: 'count_at_least(measurements.fid, 300)',
  [WebVital.CLS]: 'count_at_least(measurements.cls, 0.25)',
};
export const vitalsBaseFields = {
  [WebVital.FP]: 'count_at_least(measurements.fp, 0)',
  [WebVital.FCP]: 'count_at_least(measurements.fcp, 0)',
  [WebVital.LCP]: 'count_at_least(measurements.lcp, 0)',
  [WebVital.FID]: 'count_at_least(measurements.fid, 0)',
  [WebVital.CLS]: 'count_at_least(measurements.cls, 0)',
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

export function getVitalDetailTableStatusFunction(vitalName: WebVital): string {
  const vitalThreshold = WEB_VITAL_DETAILS[vitalName].failureThreshold;
  const statusFunction = `compare_numeric_aggregate(${getAggregateAlias(
    `p75(${vitalName})`
  )},greater,${vitalThreshold})`;
  return statusFunction;
}

export const vitalMap: Partial<Record<WebVital, string>> = {
  [WebVital.FP]: 'First Paint',
  [WebVital.FCP]: 'First Contentful Paint',
  [WebVital.CLS]: 'Cumulative Layout Shift',
  [WebVital.FID]: 'First Input Delay',
  [WebVital.LCP]: 'Largest Contentful Paint',
};

export const vitalChartTitleMap = vitalMap;

export const vitalDescription: Partial<Record<WebVital, string>> = {
  [WebVital.FP]:
    'First Paint (FP) measures the amount of time the first pixel takes to appear in the viewport, rendering any visual change from what was previously displayed. This may be in the subtle form of a background color, canvas, or image.',
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
  [WebVital.FP]: 'FP',
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
