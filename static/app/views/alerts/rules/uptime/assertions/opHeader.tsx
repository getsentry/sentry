import {useId} from 'react';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
import {SelectTrigger} from 'sentry/components/core/compactSelect/trigger';
import {t} from 'sentry/locale';
import type {HeaderCheckOp, HeaderOperand} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer} from './opCommon';

const HEADER_OPERAND_OPTIONS: Array<SelectOption<'literal' | 'glob'> & {symbol: string}> =
  [
    {value: 'literal', label: t('Literal'), symbol: '""'},
    {value: 'glob', label: t('Glob Pattern'), symbol: '\u2217'},
  ];

interface AssertionOpHeaderProps {
  onChange: (op: HeaderCheckOp) => void;
  onRemove: () => void;
  value: HeaderCheckOp;
}

export function AssertionOpHeader({value, onChange, onRemove}: AssertionOpHeaderProps) {
  const inputId = useId();

  // Filter options for header key comparisons (no less_than/greater_than)
  const headerKeyComparisonOptions = COMPARISON_OPTIONS.filter(
    opt => !['less_than', 'greater_than'].includes(opt.value)
  );

  // Filter options for header value comparisons (only equals, not_equal)
  const headerValueComparisonOptions = COMPARISON_OPTIONS.filter(opt =>
    ['equals', 'not_equal'].includes(opt.value)
  );

  const showValueInput = ['equals', 'not_equal'].includes(value.key_op.cmp);

  const getOperandValue = (operand: HeaderOperand) =>
    operand.header_op === 'literal'
      ? operand.value
      : operand.header_op === 'glob'
        ? operand.pattern.value
        : '';

  const keyOperandType = value.key_operand.header_op;
  const keyOperandValue = getOperandValue(value.key_operand);
  const valueOperandType = value.value_operand.header_op;
  const valueOperandValue = getOperandValue(value.value_operand);

  // Get combined label for key (comparison + operand)
  const keyComparisonLabel =
    headerKeyComparisonOptions.find(opt => opt.value === value.key_op.cmp)?.label ?? '';
  const keyComparisonSymbol =
    headerKeyComparisonOptions.find(opt => opt.value === value.key_op.cmp)?.symbol ?? '';
  const keyOperandLabel =
    keyOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === keyOperandType)?.label ?? '');
  const keyOperandSymbol =
    keyOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === keyOperandType)?.symbol ?? '');
  const keyCombinedLabel = keyOperandSymbol
    ? `${keyComparisonSymbol}${keyOperandSymbol}`
    : keyComparisonSymbol;
  const keyCombinedTooltip =
    keyOperandType === 'none'
      ? t('Header key %s', keyComparisonLabel)
      : t('Header key %s matching a string %s', keyComparisonLabel, keyOperandLabel);

  // Get combined label for value (comparison + operand)
  const valueComparisonLabel =
    headerValueComparisonOptions.find(opt => opt.value === value.value_op.cmp)?.label ??
    '';
  const valueComparisonSymbol =
    headerValueComparisonOptions.find(opt => opt.value === value.value_op.cmp)?.symbol ??
    '';
  const valueOperandLabel =
    valueOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === valueOperandType)?.label ?? '');
  const valueOperandSymbol =
    valueOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === valueOperandType)?.symbol ??
        '');
  const valueCombinedLabel = valueOperandSymbol
    ? `${valueComparisonSymbol}${valueOperandSymbol}`
    : valueComparisonSymbol;
  const valueCombinedTooltip =
    valueOperandType === 'none'
      ? t('Header value %s', valueComparisonLabel)
      : t('Header value %s to a string %s', valueComparisonLabel, valueOperandLabel);

  const keyInput = (
    <Container flexGrow={1}>
      {flexProps => (
        <InputGroup {...flexProps}>
          <InputGroup.LeadingItems>
            <CompositeSelect
              size="xs"
              trigger={props => (
                <SelectTrigger.Button
                  {...props}
                  size="zero"
                  borderless
                  showChevron={false}
                  title={keyCombinedTooltip}
                  aria-label={t('key comparison %s', keyCombinedLabel)}
                >
                  <Text monospace>{keyCombinedLabel}</Text>
                </SelectTrigger.Button>
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
                options={HEADER_OPERAND_OPTIONS}
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
                <SelectTrigger.Button
                  {...props}
                  size="zero"
                  borderless
                  showChevron={false}
                  title={valueCombinedTooltip}
                  aria-label={t('value comparison %s', valueCombinedLabel)}
                >
                  <Text monospace>{valueCombinedLabel}</Text>
                </SelectTrigger.Button>
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
                  options={HEADER_OPERAND_OPTIONS}
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
    <OpContainer label={t('Header')} onRemove={onRemove} inputId={inputId}>
      <Flex gap="sm" align="center" width="100%">
        {keyInput}
        {showValueInput && valueInput}
      </Flex>
    </OpContainer>
  );
}
