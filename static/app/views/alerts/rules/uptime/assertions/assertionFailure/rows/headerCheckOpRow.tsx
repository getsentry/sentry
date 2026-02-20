import {Fragment} from 'react';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {HeaderCheckOpTreeNode} from 'sentry/views/alerts/rules/uptime/assertions/assertionFailure/models/headerCheckOpTreeNode';
import {
  getHeaderKeyCombinedLabelAndTooltip,
  getHeaderOperandValue,
  getHeaderValueCombinedLabelAndTooltip,
  shouldShowHeaderValueInput,
} from 'sentry/views/alerts/rules/uptime/assertions/utils';

export function HeaderCheckOpRow({node}: {node: HeaderCheckOpTreeNode}) {
  const showValueInput = shouldShowHeaderValueInput(node.value);

  const keyOperandValue = getHeaderOperandValue(node.value.key_operand);
  const valueOperandValue = getHeaderOperandValue(node.value.value_operand);

  const {combinedLabel: keyCombinedLabel, combinedTooltip: keyCombinedTooltip} =
    getHeaderKeyCombinedLabelAndTooltip(node.value);

  const {combinedLabel: valueCombinedLabel, combinedTooltip: valueCombinedTooltip} =
    getHeaderValueCombinedLabelAndTooltip(node.value);

  const keyValueText = keyOperandValue || t('[Empty Header Key]');
  const valueValueText = valueOperandValue || t('[Empty Header Value]');

  const content = (
    <Fragment>
      <Text variant="danger">[Failed] </Text>
      Header Check | Rule:{' '}
      <Text variant="primary">
        key{' '}
        <Tooltip skipWrapper title={keyCombinedTooltip}>
          {keyCombinedLabel}
        </Tooltip>{' '}
        {keyValueText}
        {showValueInput && (
          <Fragment>
            , value{' '}
            <Tooltip skipWrapper title={valueCombinedTooltip}>
              {valueCombinedLabel}
            </Tooltip>{' '}
            {valueValueText}
          </Fragment>
        )}
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
