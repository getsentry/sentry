import {InfoText} from '@sentry/scraps/info';

import type {AndOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/andOpTreeNode';
import {getGroupOpLabel} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function AndOpRow({node}: {node: AndOpTreeNode}) {
  const label = getGroupOpLabel(node.value, node.isNegated);

  return (
    <InfoText title={label} mode="overflowOnly">
      {label}
    </InfoText>
  );
}
