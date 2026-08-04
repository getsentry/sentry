import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {JsonPathOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/jsonPathOpTreeNode';
import {
  getJsonPathCombinedLabelAndTooltip,
  getJsonPathOperandValue,
  normalizeJsonPathOp,
} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function JsonPathOpRow({node}: {node: JsonPathOpTreeNode}) {
  const normalizedOp = normalizeJsonPathOp(node.value);

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
    <InfoText
      title={<Text variant="muted">{content}</Text>}
      mode="overflowOnly"
      variant="muted"
    >
      {content}
    </InfoText>
  );
}
