import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {OrOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/orOpTreeNode';
import {getGroupOpLabel} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function OrOpRow({node}: {node: OrOpTreeNode}) {
  const label = getGroupOpLabel(node.value, node.isNegated);

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
