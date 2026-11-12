import type {Organization} from 'sentry/types/organization';

import {makeExampleTraceData} from './makeExampleTraceData';
import {TraceTree} from './traceTree';

// Creates an example trace response that we use to render the loading placeholder
export function makeExampleTrace(organization: Organization): TraceTree {
  return TraceTree.FromTrace(makeExampleTraceData(), {replay: null, organization});
}
