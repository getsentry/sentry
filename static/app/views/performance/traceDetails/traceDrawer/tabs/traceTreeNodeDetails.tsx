import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import type {Organization} from 'sentry/types/organization';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

export interface TraceTreeNodeDetailsProps<T> {
  node: T;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  traceId: string;
  hideNodeActions?: boolean;
  initiallyCollapseAiIO?: boolean;
  tree?: TraceTree;
}

// The details panels pull in replays, profiling, logs and more. Loading them
// lazily keeps that out of anything that only renders the waterfall.
const LazyNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/nodeDetails').then(
    module => ({default: module.NodeDetails})
  )
);

export function TraceTreeNodeDetails(props: TraceTreeNodeDetailsProps<BaseNode>) {
  // Keyed by node so a panel error does not stick when another node is selected.
  return <LazyLoad key={props.node.path} LazyComponent={LazyNodeDetails} {...props} />;
}
