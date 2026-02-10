import {Fragment} from 'react';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {StatusCodeOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/statusCodeOpTreeNode';
import {COMPARISON_OPTIONS} from 'sentry/views/alerts/rules/uptime/assertions/opCommon';

export function StatusCodeOpRow({node}: {node: StatusCodeOpTreeNode}) {
  const comparisonOption = COMPARISON_OPTIONS.find(
    opt => opt.value === node.value.operator.cmp
  );

  if (!comparisonOption) {
    throw new Error(`Invalid comparison operator: ${node.value.operator.cmp}`);
  }

  const {symbol, label} = comparisonOption;

  const content = (
    <Fragment>
      <Text variant="danger">[Failed] </Text>
      Status Code | Rule:{' '}
      <Text variant="primary">
        status_code{' '}
        <Tooltip skipWrapper title={label}>
          {symbol}
        </Tooltip>{' '}
        {node.value.value}
      </Text>
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
