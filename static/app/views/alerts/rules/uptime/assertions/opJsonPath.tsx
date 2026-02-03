import {useEffect, useId} from 'react';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {JsonPathOp, JsonPathOperand} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer, STRING_OPERAND_OPTIONS} from './opCommon';
import {getJsonPathCombinedLabelAndTooltip, getJsonPathOperandValue} from './utils';

interface AssertionOpJsonPathProps {
  onChange: (op: JsonPathOp) => void;
  onRemove: () => void;
  value: JsonPathOp;
}

export function AssertionOpJsonPath({
  value,
  onChange,
  onRemove,
}: AssertionOpJsonPathProps) {
  const inputId = useId();

  const operandValue = getJsonPathOperandValue(value.operand);
  const {combinedLabel, combinedTooltip} = getJsonPathCombinedLabelAndTooltip(value);

  const isNumericOperandValue = (raw: string): boolean => {
    const s = raw.trim();
    if (!s) {
      return false;
    }
    return /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
  };

  const isNumeric = isNumericOperandValue(operandValue);

  const comparisonOptions = COMPARISON_OPTIONS.filter(
    opt => !['always', 'never'].includes(opt.value)
  ).filter(opt =>
    isNumeric ? true : !['less_than', 'greater_than'].includes(opt.value)
  );

  // If the operand isn't numeric, prevent using < or > comparisons.
  useEffect(() => {
    if (isNumeric) {
      return;
    }
    if (value.operator.cmp === 'less_than' || value.operator.cmp === 'greater_than') {
      onChange({...value, operator: {cmp: 'equals'}});
    }
  }, [isNumeric, onChange, value]);

  // If the operand is numeric, force the operand type to literal.
  useEffect(() => {
    if (!isNumeric) {
      return;
    }
    if (value.operand.jsonpath_op === 'glob') {
      onChange({...value, operand: {jsonpath_op: 'literal', value: operandValue}});
    }
  }, [isNumeric, onChange, operandValue, value]);

  const jsonPathInput = (
    <Container flexGrow={2}>
      {flexProps => (
        <InputGroup {...flexProps}>
          <InputGroup.Input
            id={inputId}
            value={value.value}
            onChange={e => onChange({...value, value: e.target.value})}
            placeholder="$.status"
            monospace
          />
        </InputGroup>
      )}
    </Container>
  );

  const operandInput = (
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
                  title={combinedTooltip}
                  aria-label={t('JSON path comparison %s', combinedLabel)}
                >
                  <Text monospace>{combinedLabel}</Text>
                </OverlayTrigger.Button>
              )}
            >
              <CompositeSelect.Region
                label={t('Comparison')}
                value={value.operator.cmp}
                onChange={option => onChange({...value, operator: {cmp: option.value}})}
                options={comparisonOptions}
              />
              {!isNumeric && (
                <CompositeSelect.Region
                  label={t('String type')}
                  value={value.operand.jsonpath_op}
                  onChange={option => {
                    const newOperand: JsonPathOperand =
                      option.value === 'literal'
                        ? {jsonpath_op: 'literal', value: operandValue}
                        : {jsonpath_op: 'glob', pattern: {value: operandValue}};
                    onChange({...value, operand: newOperand});
                  }}
                  options={STRING_OPERAND_OPTIONS}
                />
              )}
            </CompositeSelect>
          </InputGroup.LeadingItems>
          <InputGroup.Input
            value={operandValue}
            onChange={e => {
              const nextValue = e.target.value;
              const nextIsNumeric = isNumericOperandValue(nextValue);

              const newOperand: JsonPathOperand = nextIsNumeric
                ? {jsonpath_op: 'literal', value: nextValue}
                : value.operand.jsonpath_op === 'glob'
                  ? {jsonpath_op: 'glob', pattern: {value: nextValue}}
                  : {jsonpath_op: 'literal', value: nextValue};
              onChange({...value, operand: newOperand});
            }}
            aria-label={t('JSON path expected value')}
            placeholder="ok"
            monospace
          />
        </InputGroup>
      )}
    </Container>
  );

  return (
    <OpContainer
      label={t('JSON Path')}
      onRemove={onRemove}
      inputId={inputId}
      tooltip={tct(
        'The assertion evaluates to true if the JSON path matches. See the [link:JSON Path RFC] for more information.',
        {
          link: <ExternalLink href="https://www.rfc-editor.org/rfc/rfc9535.html" />,
        }
      )}
      op={value}
    >
      <Flex gap="sm" align="center" width="100%">
        {jsonPathInput}
        {operandInput}
      </Flex>
    </OpContainer>
  );
}
