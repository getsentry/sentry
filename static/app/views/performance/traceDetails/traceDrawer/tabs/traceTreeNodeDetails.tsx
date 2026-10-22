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
