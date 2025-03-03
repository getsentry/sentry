import type {TraceResult} from './hooks/useTraces';
import type {SpanResult} from './hooks/useTraceSpans';
import type {Field} from './data';

export function normalizeTraces(traces: TraceResult[] | undefined) {
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

export function areQueriesEmpty(queries: string[]): boolean {
  if (queries.length > 1) {
    return false;
  }
  if (queries.length === 0) {
    return true;
  }

  if (queries.length === 1) {
    return queries[0]!.length === 0;
  }

  return false;
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
