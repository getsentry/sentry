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
    return sliceSecondaryName.slice(-2) + (sliceName ? sliceName.slice(0, 3) : '');
  }

  return sliceName;
}

const PRIORITIZED_BREAKDOWN_OPS = ['db'];

export function getSecondaryNameFromSpan(span: SpanResult<Field>) {
  return span['sdk.name'];
}

export function getModifiedZIndex(stylingSliceName: string | null) {
  if (PRIORITIZED_BREAKDOWN_OPS.includes(stylingSliceName ?? '')) {
    return 1;
  }

  return null;
}
