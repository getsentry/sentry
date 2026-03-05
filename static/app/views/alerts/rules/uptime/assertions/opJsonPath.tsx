import {useEffect, useId} from 'react';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {isNumericString} from 'sentry/utils';
import {
  UptimeComparisonType,
  type UptimeJsonPathOp,
  type UptimeJsonPathOperand,
  type UptimeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer, STRING_OPERAND_OPTIONS} from './opCommon';
import {
  getJsonPathCombinedLabelAndTooltip,
  getJsonPathOperandValue,
  isNumericComparison,
  normalizeJsonPathOp,
} from './utils';

interface AssertionOpJsonPathProps {
  onChange: (op: UptimeJsonPathOp) => void;
  onRemove: () => void;
  value: UptimeJsonPathOp;
  erroredOp?: UptimeOp;
}

export function AssertionOpJsonPath({
  value,
  onChange,
  onRemove,
  erroredOp,
}: AssertionOpJsonPathProps) {
  const inputId = useId();

  const normalizedOp = normalizeJsonPathOp(value);

  const operandValue = getJsonPathOperandValue(normalizedOp.operand);
  const {combinedLabel, combinedTooltip} =
    getJsonPathCombinedLabelAndTooltip(normalizedOp);

  const isNumericValue = isNumericString(operandValue);
  const isNumericComparisonSelected = isNumericComparison(normalizedOp.operator.cmp);

  const comparisonOptions = COMPARISON_OPTIONS.filter(
    opt =>
      opt.value !== UptimeComparisonType.ALWAYS &&
      opt.value !== UptimeComparisonType.NEVER
  ).map(opt => {
    const isNumericOnly = isNumericComparison(opt.value);
    return {
      ...opt,
      disabled: isNumericOnly && !isNumericValue,
      tooltip:
        isNumericOnly && !isNumericValue
          ? t('Only available for numeric values')
          : undefined,
    };
  });

  const stringOperandOptions = STRING_OPERAND_OPTIONS.map(opt => ({
    ...opt,
    disabled: isNumericComparisonSelected,
    tooltip: isNumericComparisonSelected
      ? t('Only available for string comparisons')
      : undefined,
  }));

  useEffect(() => {
    // Non-numeric with < or > selected: force back to equals
    if (!isNumericValue && isNumericComparisonSelected) {
      onChange({...normalizedOp, operator: {cmp: UptimeComparisonType.EQUALS}});
    }
  }, [isNumericValue, isNumericComparisonSelected, onChange, normalizedOp]);

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
                  tooltipProps={{title: combinedTooltip}}
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
              <CompositeSelect.Region
                label={t('String operand types')}
                value={normalizedOp.operand.jsonpath_op}
                onChange={option => {
                  const newOperand: UptimeJsonPathOperand =
                    option.value === 'literal'
                      ? {jsonpath_op: 'literal', value: operandValue}
                      : {jsonpath_op: 'glob', pattern: {value: operandValue}};
                  onChange({...normalizedOp, operand: newOperand});
                }}
                options={stringOperandOptions}
              />
            </CompositeSelect>
          </InputGroup.LeadingItems>
          <InputGroup.Input
            value={operandValue}
            onChange={e => {
              const nextValue = e.target.value;

              const newOperand: UptimeJsonPathOperand =
                normalizedOp.operand.jsonpath_op === 'glob'
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
      erroredOp={erroredOp}
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
