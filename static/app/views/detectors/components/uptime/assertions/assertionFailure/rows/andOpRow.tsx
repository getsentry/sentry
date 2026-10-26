import {InfoText} from '@sentry/scraps/info';

import type {AndOpTreeNode} from 'sentry/views/detectors/components/uptime/assertions/assertionFailure/models/andOpTreeNode';
import {getGroupOpLabel} from 'sentry/views/detectors/components/uptime/assertions/utils';

export function AndOpRow({node}: {node: AndOpTreeNode}) {
  const label = getGroupOpLabel(node.value, node.isNegated);

  return (
    <InfoText title={label} mode="overflowOnly">
      {label}
    </InfoText>
  );
}
