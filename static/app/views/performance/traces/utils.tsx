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
    return sliceSecondaryName.slice(-2) + (sliceName ?? '');
  }

  return sliceName;
}

export function getSecondaryNameFromSpan(span: SpanResult<Field>) {
  return span['sdk.name'];
}
