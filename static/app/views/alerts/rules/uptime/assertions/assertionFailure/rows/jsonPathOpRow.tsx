import {Text} from 'sentry/components/core/text/text';
import type {JsonPathOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/jsonPathOpTreeNode';

export function JsonPathOpRow({node}: {node: JsonPathOpTreeNode}) {
  return (
    <Text variant="muted" ellipsis>
      <Text variant="danger">[Failed] </Text>
      JSON Path | Rule: <Text variant="primary">{node.value.value}</Text>
    </Text>
  );
}
