import {Alert} from 'sentry/components/core/alert';
import {isOrphanSpan} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

function Alerts({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  if (!isOrphanSpan(node.value)) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert type="info" system>
        {t(
          'This is a span that has no parent span within this transaction. It has been attached to the transaction root span by default.'
        )}
      </Alert>
    </Alert.Container>
  );
}

export default Alerts;
