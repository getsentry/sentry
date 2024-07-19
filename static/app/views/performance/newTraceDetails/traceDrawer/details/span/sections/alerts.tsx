import Alert from 'sentry/components/alert';
import {isOrphanSpan} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function Alerts({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  if (!isOrphanSpan(node.value)) {
    return null;
  }

  return (
    <Alert type="info" showIcon system>
      {t(
        'This is a span that has no parent span within this transaction. It has been attached to the transaction root span by default.'
      )}
    </Alert>
  );
}

export default Alerts;
