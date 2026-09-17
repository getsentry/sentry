import {InfoText} from '@sentry/scraps/info';

import type {OrOpTreeNode} from 'sentry/views/detectors/components/uptime/assertions/assertionFailure/models/orOpTreeNode';
import {getGroupOpLabel} from 'sentry/views/detectors/components/uptime/assertions/utils';

export function OrOpRow({node}: {node: OrOpTreeNode}) {
  const label = getGroupOpLabel(node.value, node.isNegated);

  return (
    <InfoText title={label} mode="overflowOnly">
      {label}
    </InfoText>
  );
}
