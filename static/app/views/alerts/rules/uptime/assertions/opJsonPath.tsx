import {useEffect, useId} from 'react';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {isNumericString} from 'sentry/utils';
import type {JsonPathOp, JsonPathOperand} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer, STRING_OPERAND_OPTIONS} from './opCommon';
import {
  getJsonPathCombinedLabelAndTooltip,
  getJsonPathOperandValue,
  normalizeJsonPathOp,
} from './utils';

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

  const normalizedOp: JsonPathOp = normalizeJsonPathOp(value);

  const operandValue = getJsonPathOperandValue(normalizedOp.operand);
  const {combinedLabel, combinedTooltip} =
    getJsonPathCombinedLabelAndTooltip(normalizedOp);

  const isNumeric = isNumericString(operandValue);

  const comparisonOptions = COMPARISON_OPTIONS.filter(opt => {
    if (opt.value === 'always' || opt.value === 'never') {
      return false;
    }
    if (!isNumeric && (opt.value === 'less_than' || opt.value === 'greater_than')) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    // Normalize the op based on whether the operand is numeric.
    //
    // - Non-numeric: disallow < and > comparisons (force equals).
    // - Numeric: force a literal operand (hide/disable glob).
    let nextValue: JsonPathOp | null = null;

    if (
      !isNumeric &&
      (normalizedOp.operator.cmp === 'less_than' ||
        normalizedOp.operator.cmp === 'greater_than')
    ) {
      nextValue = {...normalizedOp, operator: {cmp: 'equals'}};
    }

    if (isNumeric && normalizedOp.operand.jsonpath_op === 'glob') {
      nextValue = {
        ...(nextValue ?? normalizedOp),
        operand: {jsonpath_op: 'literal', value: operandValue},
      };
    }

    if (nextValue) {
      onChange(nextValue);
    }
  }, [isNumeric, onChange, operandValue, normalizedOp]);

  const jsonPathInput = (
    <Container flexGrow={2}>
      {flexProps => (
        <InputGroup {...flexProps}>
          <InputGroup.Input
            data-test-id="json-path-value-input"
            aria-label={t('JSON path value input')}
            id={inputId}
            value={normalizedOp.value}
            onChange={e => onChange({...normalizedOp, value: e.target.value})}
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
                  data-test-id="json-path-operators-trigger"
                  {...props}
                  size="zero"
                  priority="transparent"
                  showChevron={false}
                  title={combinedTooltip}
                  aria-label={t('JSON path operators trigger')}
                >
                  <Text monospace>{combinedLabel}</Text>
                </OverlayTrigger.Button>
              )}
            >
              <CompositeSelect.Region
                data-test-id="json-path-operator-options"
                aria-label={t('JSON path operator options')}
                value={normalizedOp.operator.cmp}
                onChange={option =>
                  onChange({...normalizedOp, operator: {cmp: option.value}})
                }
                options={comparisonOptions}
              />
              {!isNumeric && (
                <CompositeSelect.Region
                  label={t('String operand types')}
                  value={normalizedOp.operand.jsonpath_op}
                  onChange={option => {
                    const newOperand: JsonPathOperand =
                      option.value === 'literal'
                        ? {jsonpath_op: 'literal', value: operandValue}
                        : {jsonpath_op: 'glob', pattern: {value: operandValue}};
                    onChange({...normalizedOp, operand: newOperand});
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
              const nextIsNumeric = isNumericString(nextValue);

              const newOperand: JsonPathOperand = nextIsNumeric
                ? {jsonpath_op: 'literal', value: nextValue}
                : normalizedOp.operand.jsonpath_op === 'glob'
                  ? {jsonpath_op: 'glob', pattern: {value: nextValue}}
                  : {jsonpath_op: 'literal', value: nextValue};
              onChange({...normalizedOp, operand: newOperand});
            }}
            data-test-id="json-path-operand-value"
            aria-label={t('JSON path operand value')}
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
      op={normalizedOp}
    >
      <Flex gap="sm" align="center" width="100%">
        {jsonPathInput}
        {operandInput}
      </Flex>
    </OpContainer>
  );
}
