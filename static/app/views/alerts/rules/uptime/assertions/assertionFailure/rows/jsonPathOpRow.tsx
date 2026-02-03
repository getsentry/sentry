import {Fragment} from 'react';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {JsonPathOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/jsonPathOpTreeNode';
import {
  getJsonPathCombinedLabelAndTooltip,
  getJsonPathOperandValue,
  normalizeJsonPathOp,
} from 'sentry/views/alerts/rules/uptime/assertions/utils';
import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

export function JsonPathOpRow({node}: {node: JsonPathOpTreeNode}) {
  const normalizedOp: JsonPathOp = normalizeJsonPathOp(node.value);

  const operandValue = getJsonPathOperandValue(normalizedOp.operand);
  const {combinedLabel, combinedTooltip} =
    getJsonPathCombinedLabelAndTooltip(normalizedOp);

  const content = (
    <Fragment>
      <Text variant="danger">[Failed] </Text>
      JSON Path | Rule:{' '}
      <Text variant="primary">
        {normalizedOp.value}{' '}
        <Tooltip skipWrapper title={combinedTooltip}>
          {combinedLabel}
        </Tooltip>{' '}
        {operandValue}
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
