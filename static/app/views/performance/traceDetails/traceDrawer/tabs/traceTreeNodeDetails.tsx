import type {Organization} from 'sentry/types/organization';
import {NodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/nodeDetails';
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

export function TraceTreeNodeDetails(props: TraceTreeNodeDetailsProps<BaseNode>) {
  // Keyed by node so a panel error does not stick when another node is selected.
  return <NodeDetails key={props.node.path} {...props} />;
}
