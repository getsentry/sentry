import {Fragment} from 'react';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {JsonPathOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/jsonPathOpTreeNode';
import {
  getJsonPathCombinedLabelAndTooltip,
  getJsonPathOperandValue,
} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function JsonPathOpRow({node}: {node: JsonPathOpTreeNode}) {
  const operandValue = getJsonPathOperandValue(node.value.operand);
  const {combinedLabel, combinedTooltip} = getJsonPathCombinedLabelAndTooltip(node.value);

  const content = (
    <Fragment>
      <Text variant="danger">[Failed] </Text>
      JSON Path | Rule:{' '}
      <Text variant="primary">
        {node.value.value}{' '}
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
