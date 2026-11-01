import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {AutogroupNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/autogroup';
import {ErrorNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/error';
import {MissingInstrumentationNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/missingInstrumentation';
import {EAPSpanNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/span';
import {AiSpanDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/aiSpanDetails';
import {UptimeNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/uptime';
import {UptimeTimingDetails} from 'sentry/views/performance/traceDetails/traceDrawer/details/uptime/timing';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {ErrorNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/errorNode';
import {NoInstrumentationNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/noInstrumentationNode';
import {ParentAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/parentAutogroupNode';
import {SiblingAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/siblingAutogroupNode';
import {UptimeCheckNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {UptimeCheckTimingNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckTimingNode';

/**
 * Picks the drawer details panel for a trace tree node. Matches on the node
 * class so each node gets the panel its class rendered when the models owned
 * this choice.
 */
export function NodeDetails(props: TraceTreeNodeDetailsProps<BaseNode>) {
  const {node} = props;

  if (node instanceof EapSpanNode) {
    if (getIsAiNode(node)) {
      return <AiSpanDetails node={node} traceId={props.traceId} />;
    }
    return <EAPSpanNodeDetails {...props} node={node} />;
  }
  if (node instanceof ErrorNode) {
    return <ErrorNodeDetails {...props} node={node} />;
  }
  if (node instanceof NoInstrumentationNode) {
    return <MissingInstrumentationNodeDetails {...props} node={node} />;
  }
  if (node instanceof ParentAutogroupNode || node instanceof SiblingAutogroupNode) {
    return <AutogroupNodeDetails {...props} node={node} />;
  }
  if (node instanceof UptimeCheckNode) {
    return <UptimeNodeDetails {...props} node={node} />;
  }
  if (node instanceof UptimeCheckTimingNode) {
    return <UptimeTimingDetails {...props} node={node} />;
  }
  return null;
}
