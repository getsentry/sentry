import {useId} from 'react';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {HeaderCheckOp, HeaderOperand} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer, STRING_OPERAND_OPTIONS} from './opCommon';
import {
  getHeaderKeyCombinedLabelAndTooltip,
  getHeaderOperandValue,
  getHeaderValueCombinedLabelAndTooltip,
  shouldShowHeaderValueInput,
} from './utils';

interface AssertionOpHeaderProps {
  onChange: (op: HeaderCheckOp) => void;
  onRemove: () => void;
  value: HeaderCheckOp;
}

export function AssertionOpHeader({value, onChange, onRemove}: AssertionOpHeaderProps) {
  const inputId = useId();

  const headerKeyComparisonOptions = COMPARISON_OPTIONS.filter(
    opt => !['less_than', 'greater_than'].includes(opt.value)
  );
  const headerValueComparisonOptions = COMPARISON_OPTIONS.filter(opt =>
    ['equals', 'not_equal'].includes(opt.value)
  );

  const showValueInput = shouldShowHeaderValueInput(value);

  const keyOperandType = value.key_operand.header_op;
  const keyOperandValue = getHeaderOperandValue(value.key_operand);
  const valueOperandType = value.value_operand.header_op;
  const valueOperandValue = getHeaderOperandValue(value.value_operand);

  const {combinedLabel: keyCombinedLabel, combinedTooltip: keyCombinedTooltip} =
    getHeaderKeyCombinedLabelAndTooltip(value);

  const {combinedLabel: valueCombinedLabel, combinedTooltip: valueCombinedTooltip} =
    getHeaderValueCombinedLabelAndTooltip(value);

  const keyInput = (
    <Container flexGrow={1}>
      {flexProps => (
        <InputGroup {...flexProps}>
          <InputGroup.LeadingItems>
            <CompositeSelect
              size="xs"
              trigger={props => (
                <OverlayTrigger.Button
                  {...props}
                  size="zero"
                  priority="transparent"
                  showChevron={false}
                  title={keyCombinedTooltip}
                  aria-label={t('key comparison %s', keyCombinedLabel)}
                >
                  <Text monospace>{keyCombinedLabel}</Text>
                </OverlayTrigger.Button>
              )}
            >
              <CompositeSelect.Region
                label={t('Key is')}
                value={value.key_op.cmp}
                onChange={option => {
                  const isAlwaysNever = ['always', 'never'].includes(option.value);
                  const wasAlwaysNever = ['always', 'never'].includes(value.key_op.cmp);

                  onChange({
                    ...value,
                    key_op: {cmp: option.value},
                    value_op: isAlwaysNever
                      ? {cmp: option.value}
                      : wasAlwaysNever
                        ? {cmp: 'equals'}
                        : value.value_op,
                    value_operand: isAlwaysNever
                      ? {header_op: 'none'}
                      : wasAlwaysNever
                        ? {header_op: 'literal', value: ''}
                        : value.value_operand,
                  });
                }}
                options={headerKeyComparisonOptions}
              />
              <CompositeSelect.Region
                label={t('String type')}
                value={keyOperandType === 'none' ? 'literal' : keyOperandType}
                onChange={option => {
                  const newOperand: HeaderOperand =
                    option.value === 'literal'
                      ? {header_op: 'literal', value: keyOperandValue}
                      : {header_op: 'glob', pattern: {value: keyOperandValue}};
                  onChange({...value, key_operand: newOperand});
                }}
                options={STRING_OPERAND_OPTIONS}
              />
            </CompositeSelect>
          </InputGroup.LeadingItems>
          <InputGroup.Input
            id={inputId}
            value={keyOperandValue}
            onChange={e => {
              const newOperand: HeaderOperand =
                keyOperandType === 'glob'
                  ? {header_op: 'glob', pattern: {value: e.target.value}}
                  : {header_op: 'literal', value: e.target.value};
              onChange({...value, key_operand: newOperand});
            }}
            placeholder={t('[Empty Header Key]')}
            monospace
          />
        </InputGroup>
      )}
    </Container>
  );

  const valueInput = (
    <Container flexGrow={3}>
      {flexProps => (
        <InputGroup {...flexProps}>
          <InputGroup.LeadingItems>
            <CompositeSelect
              size="xs"
              trigger={props => (
                <OverlayTrigger.Button
                  {...props}
                  size="zero"
                  priority="transparent"
                  showChevron={false}
                  title={valueCombinedTooltip}
                  aria-label={t('value comparison %s', valueCombinedLabel)}
                >
                  <Text monospace>{valueCombinedLabel}</Text>
                </OverlayTrigger.Button>
              )}
            >
              <CompositeSelect.Region
                label={t('Value is')}
                value={value.value_op.cmp}
                onChange={option => onChange({...value, value_op: {cmp: option.value}})}
                options={headerValueComparisonOptions}
              />
              {valueOperandType !== 'none' && (
                <CompositeSelect.Region
                  label={t('String type')}
                  value={valueOperandType}
                  onChange={option => {
                    const newOperand: HeaderOperand =
                      option.value === 'literal'
                        ? {header_op: 'literal', value: valueOperandValue}
                        : {header_op: 'glob', pattern: {value: valueOperandValue}};
                    onChange({...value, value_operand: newOperand});
                  }}
                  options={STRING_OPERAND_OPTIONS}
                />
              )}
            </CompositeSelect>
          </InputGroup.LeadingItems>
          <InputGroup.Input
            value={valueOperandValue}
            onChange={e => {
              const newOperand: HeaderOperand =
                valueOperandType === 'glob'
                  ? {header_op: 'glob', pattern: {value: e.target.value}}
                  : {header_op: 'literal', value: e.target.value};
              onChange({...value, value_operand: newOperand});
            }}
            placeholder={t('[Empty Header Value]')}
            monospace
          />
        </InputGroup>
      )}
    </Container>
  );

  return (
    <OpContainer label={t('Header')} onRemove={onRemove} inputId={inputId} op={value}>
      <Flex gap="sm" align="center" width="100%">
        {keyInput}
        {showValueInput && valueInput}
      </Flex>
    </OpContainer>
  );
}
