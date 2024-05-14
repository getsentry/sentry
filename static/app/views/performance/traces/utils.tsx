import type {Location, LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';

import type {SpanResult, TraceResult} from './content';
import type {Field} from './data';

export function normalizeTraces(traces: TraceResult<string>[] | undefined) {
  if (!traces) {
    return traces;
  }
  return traces.sort(
    // Only sort name == null to the end, the rest leave in the original order.
    (t1, t2) => (t1.name ? '0' : '1').localeCompare(t2.name ? '0' : '1')
  );
}

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

export function generateTracesRoute({orgSlug}: {orgSlug: Organization['slug']}): string {
  return `/organizations/${orgSlug}/performance/traces/`;
}

export function generateTracesRouteWithQuery({
  orgSlug,
  metric,
  query,
}: {
  orgSlug: Organization['slug'];
  metric?: {
    metricsOp: string;
    mri: string;
    metricsQuery?: string;
  };
  query?: Location['query'];
}): LocationDescriptor {
  const {metricsOp, metricsQuery, mri} = metric || {};

  const pathname = generateTracesRoute({orgSlug});

  return {
    pathname,
    query: {
      ...query,
      metricsOp,
      metricsQuery,
      mri,
    },
  };
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
