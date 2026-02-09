import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {AndOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/andOpTreeNode';
import {getGroupOpLabel} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function AndOpRow({node}: {node: AndOpTreeNode}) {
  const label = getGroupOpLabel(node.value, node.isNegated);

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
