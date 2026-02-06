import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {OrOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/orOpTreeNode';

export function OrOpRow({node}: {node: OrOpTreeNode}) {
  const label = node.isNegated ? t('Assert Not Any') : t('Assert Any');

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
