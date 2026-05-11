import type {Organization} from 'sentry/types/organization';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

export interface TraceTreeNodeDetailsProps<T> {
  manager: VirtualizedViewManager | null;
  node: T;
  onParentClick: (node: BaseNode) => void;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  replay: ReplayRecord | null;
  traceId: string;
  hideNodeActions?: boolean;
  initiallyCollapseAiIO?: boolean;
  tree?: TraceTree;
}
