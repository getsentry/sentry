import {Fragment} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Text} from 'sentry/components/core/text/text';
import type {JsonPathOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/jsonPathOpTreeNode';

export function JsonPathOpRow({node}: {node: JsonPathOpTreeNode}) {
  const content = (
    <Fragment>
      <Text variant="danger">[Failed] </Text>
      JSON Path | Rule: <Text variant="primary">{node.value.value}</Text>
    </Fragment>
  );

  return (
    <Tooltip title={<Text variant="muted">{content}</Text>} showOnlyOnOverflow>
      <Text variant="muted" ellipsis>
        {content}
      </Text>
    </Tooltip>
  );
}
