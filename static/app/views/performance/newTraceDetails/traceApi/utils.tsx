import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceSplitResults} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export function shouldAddMissingInstrumentationSpan(sdk: string | undefined): boolean {
  if (!sdk) {
    return true;
  }
  if (sdk.length < 'sentry.javascript.'.length) {
    return true;
  }

  switch (sdk.toLowerCase()) {
    case 'sentry.javascript.browser':
    case 'sentry.javascript.react':
    case 'sentry.javascript.gatsby':
    case 'sentry.javascript.ember':
    case 'sentry.javascript.vue':
    case 'sentry.javascript.angular':
    case 'sentry.javascript.angular-ivy':
    case 'sentry.javascript.nextjs':
    case 'sentry.javascript.nuxt':
    case 'sentry.javascript.electron':
    case 'sentry.javascript.remix':
    case 'sentry.javascript.svelte':
    case 'sentry.javascript.sveltekit':
    case 'sentry.javascript.react-native':
    case 'sentry.javascript.astro':
      return false;
    case undefined:
      return true;
    default:
      return true;
  }
}

export function isJavascriptSDKEvent(value: TraceTree.NodeValue): boolean {
  return (
    !!value &&
    'sdk_name' in value &&
    /javascript|angular|astro|backbone|ember|gatsby|nextjs|react|remix|svelte|vue/.test(
      value.sdk_name
    )
  );
}

export function isBrowserRequestNode(node: BaseNode): boolean {
  return (
    // Adjust for SDK changes in https://github.com/getsentry/sentry-javascript/pull/13527
    node.op === 'browser.request' ||
    (node.op === 'browser' && node.description === 'request')
  );
}

export function isStandaloneSpanMeasurementNode(node: BaseNode): boolean {
  if (node.value && 'op' in node.value && node.value.op) {
    if (
      node.value.op.startsWith('ui.webvital.') ||
      node.value.op.startsWith('ui.interaction.')
    ) {
      return true;
    }
  }

  return false;
}

export function isRootEvent(value: TraceTree.NodeValue): boolean {
  // Root events has no parent_span_id
  return !!value && 'parent_span_id' in value && value.parent_span_id === null;
}

export function isTraceSplitResult(
  result: TraceTree.Trace
): result is TraceSplitResults<TraceTree.Transaction> {
  return 'transactions' in result && 'orphan_errors' in result;
}

export function isEmptyTrace(trace: TraceTree.Trace): boolean {
  if (isTraceSplitResult(trace)) {
    return trace.transactions.length === 0 && trace.orphan_errors.length === 0;
  }

  return trace.length === 0;
}

export const isTraceItemDetailsResponse = (
  data: TraceRootEventQueryResults['data']
): data is TraceItemDetailsResponse => {
  return data !== undefined && 'attributes' in data;
};

export const isValidEventUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}[0-9a-f]{4}[1-5][0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
