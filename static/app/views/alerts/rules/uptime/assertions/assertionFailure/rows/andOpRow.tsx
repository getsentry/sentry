import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {AndOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/andOpTreeNode';

export function AndOpRow({node}: {node: AndOpTreeNode}) {
  const label = node.isNegated ? t('Assert None') : t('Assert All');

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
