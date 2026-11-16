import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {getGenAiOpType} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {ErrorNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/errorNode';
import {NoInstrumentationNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/noInstrumentationNode';
import {ParentAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/parentAutogroupNode';
import {ServerRenderNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/serverRenderNode';
import {SiblingAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/siblingAutogroupNode';
import {UptimeCheckNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {UptimeCheckTimingNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckTimingNode';

// The details panels pull in replays, profiling, logs and more. Each one loads
// on its own, so selecting a node loads only its panel, and anything that only
// renders the waterfall loads none of them.
const LazyEAPSpanNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/span').then(
    module => ({default: module.EAPSpanNodeDetails})
  )
);
const LazyAiSpanDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/span/aiSpanDetails').then(
    module => ({default: module.AiSpanNodeDetails})
  )
);
const LazyErrorNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/error').then(
    module => ({default: module.ErrorNodeDetails})
  )
);
const LazyMissingInstrumentationNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/missingInstrumentation').then(
    module => ({default: module.MissingInstrumentationNodeDetails})
  )
);
const LazyServerRenderNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/serverRender').then(
    module => ({default: module.ServerRenderNodeDetails})
  )
);
const LazyAutogroupNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/autogroup').then(
    module => ({default: module.AutogroupNodeDetails})
  )
);
const LazyUptimeNodeDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/uptime').then(
    module => ({default: module.UptimeNodeDetails})
  )
);
const LazyUptimeTimingDetails = lazy(() =>
  import('sentry/views/performance/traceDetails/traceDrawer/details/uptime/timing').then(
    module => ({default: module.UptimeTimingDetails})
  )
);

/**
 * Picks the drawer details panel for a trace tree node. Matches on the node
 * class so each node gets the panel its class rendered when the models owned
 * this choice.
 */
export function NodeDetails(props: TraceTreeNodeDetailsProps<BaseNode>) {
  const {node} = props;

  if (node instanceof EapSpanNode) {
    const operationType = getGenAiOpType(node);
    if (operationType) {
      return (
        <LazyLoad
          LazyComponent={LazyAiSpanDetails}
          node={node}
          operationType={operationType}
          traceId={props.traceId}
        />
      );
    }
    return <LazyLoad LazyComponent={LazyEAPSpanNodeDetails} {...props} node={node} />;
  }
  if (node instanceof ErrorNode) {
    return <LazyLoad LazyComponent={LazyErrorNodeDetails} {...props} node={node} />;
  }
  if (node instanceof NoInstrumentationNode) {
    return (
      <LazyLoad
        LazyComponent={LazyMissingInstrumentationNodeDetails}
        {...props}
        node={node}
      />
    );
  }
  if (node instanceof ServerRenderNode) {
    return (
      <LazyLoad LazyComponent={LazyServerRenderNodeDetails} {...props} node={node} />
    );
  }
  if (node instanceof ParentAutogroupNode || node instanceof SiblingAutogroupNode) {
    return <LazyLoad LazyComponent={LazyAutogroupNodeDetails} {...props} node={node} />;
  }
  if (node instanceof UptimeCheckNode) {
    return <LazyLoad LazyComponent={LazyUptimeNodeDetails} {...props} node={node} />;
  }
  if (node instanceof UptimeCheckTimingNode) {
    return <LazyLoad LazyComponent={LazyUptimeTimingDetails} {...props} node={node} />;
  }
  return null;
}
