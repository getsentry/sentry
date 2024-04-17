import type {TraceResult} from './content';

export function normalizeTraces(traces: TraceResult<string>[] | undefined) {
  if (!traces) {
    return traces;
  }
  return traces.sort(
    // Only sort name == null to the end, the rest leave in the original order.
    (t1, t2) => (t1.name ? '0' : '1').localeCompare(t2.name ? '0' : '1')
  );
}
