import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {SpanResult} from 'sentry/views/explore/tables/tracesTable/types';
import {getExploreUrl, type GetExploreUrlArgs} from 'sentry/views/explore/utils';

import type {Field} from './data';

export function getStylingSliceName(
  sliceName: string | null,
  sliceSecondaryName: string | null
) {
  if (sliceSecondaryName) {
    // Our color picking relies on the first 4 letters. Since we want to differentiate sdknames and project names we have to include part of the sdk name.
    return (sliceName ?? '').slice(0, 1) + sliceSecondaryName.slice(-4);
  }

  return sliceName;
}

export function getSecondaryNameFromSpan(span: SpanResult<Field>) {
  return span['sdk.name'];
}

export function getShortenedSdkName(sdkName: string | null) {
  if (!sdkName) {
    return '';
  }
  const sdkNameParts = sdkName.split('.');
  if (sdkNameParts.length <= 1) {
    return sdkName;
  }
  return sdkNameParts[sdkNameParts.length - 1];
}

export function isPartialSpanOrTraceData(timestamp: string | number) {
  const now = moment();
  const timestampDate = moment(timestamp);
  return now.diff(timestampDate, 'days') > 30;
}

interface GetSimilarEventsUrlArgs {
  organization: Organization;
  projectIds: number[];
  queryString: string;
  selection: PageFilters;
  mode?: Mode;
  table?: GetExploreUrlArgs['table'];
}

export function getSimilarEventsUrl({
  queryString,
  mode,
  table,
  organization,
  projectIds,
  selection,
}: GetSimilarEventsUrlArgs) {
  return getExploreUrl({
    organization,
    mode: mode ?? Mode.SAMPLES,
    query: queryString,
    table,
    selection: {
      ...selection,
      projects: projectIds,
      datetime: {start: null, end: null, utc: null, period: '24h'},
    },
    referrer: 'partial-trace',
  });
}
