import {Alert} from 'sentry/components/core/alert';
import {isOrphanSpan} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';

function Alerts({node}: {node: SpanNode}) {
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
