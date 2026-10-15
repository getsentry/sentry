import {type ReactNode} from 'react';
import styled from '@emotion/styled';

import {type SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {FilterKeyDetailsTooltip} from 'sentry/components/searchQueryBuilder/tokens/filter/filterKeyDetailsTooltip';
import {
  DATE_OP_LABELS,
  DATE_OPTIONS,
  getLabelAndOperatorFromToken,
  getValidOpsForFilter,
  OP_LABELS,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {isDateToken} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  negationOperators,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {isRegexOperator} from 'sentry/components/searchSyntax/utils';
import {type FieldDefinition} from 'sentry/utils/fields';

function getOperatorFromDateToken(token: TokenResult<Token.FILTER>) {
  switch (token.filter) {
    case FilterType.DATE:
    case FilterType.SPECIFIC_DATE:
      return token.operator;
    case FilterType.RELATIVE_DATE:
      return token.value.sign === '+'
        ? TermOperator.LESS_THAN
        : TermOperator.GREATER_THAN;
    default:
      return TermOperator.DEFAULT;
  }
}

function FilterKeyOperatorLabel({
  keyValue,
  keyLabel,
  opLabel,
  includeKeyLabel,
}: {
  keyLabel: string;
  keyValue: string;
  includeKeyLabel?: boolean;
  opLabel?: string;
}) {
  if (!includeKeyLabel) {
    return <OpLabel>{opLabel}</OpLabel>;
  }

  return (
    <Flex align="center" gap="sm">
      <FilterKeyDetailsTooltip keyName={keyValue}>
        <span>{keyLabel}</span>
        {opLabel ? <OpLabel> {opLabel}</OpLabel> : null}
      </FilterKeyDetailsTooltip>
    </Flex>
  );
}

function isNegationOperator(op: TermOperator) {
  return negationOperators.includes(op);
}

export function getOperatorInfo({
  filterToken,
  fieldDefinition,
  disallowNegation,
  allowRegexOperators,
}: {
  fieldDefinition: FieldDefinition | null;
  filterToken: TokenResult<Token.FILTER>;
  allowRegexOperators?: boolean;
  disallowNegation?: boolean;
}): {
  label: ReactNode;
  operator: TermOperator;
  options: Array<SelectOption<TermOperator>>;
} {
  if (isDateToken(filterToken)) {
    const operator = getOperatorFromDateToken(filterToken);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <OpLabel>{opLabel}</OpLabel>,
      options: DATE_OPTIONS.map((op): SelectOption<TermOperator> => {
        const optionOpLabel = DATE_OP_LABELS[op] ?? op;

        return {
          value: op,
          textValue: optionOpLabel,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
        };
      }),
    };
  }

  const {operator} = getLabelAndOperatorFromToken(filterToken);

  if (filterToken.filter === FilterType.IS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={filterToken.key.value}
          keyLabel={filterToken.key.text}
          opLabel={operator === TermOperator.NOT_EQUAL ? 'not' : undefined}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={filterToken.key.text}
              keyValue={filterToken.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'is',
        },
        ...(disallowNegation
          ? []
          : [
              {
                value: TermOperator.NOT_EQUAL,
                label: (
                  <FilterKeyOperatorLabel
                    keyLabel={filterToken.key.text}
                    keyValue={filterToken.key.value}
                    opLabel="not"
                    includeKeyLabel
                  />
                ),
                textValue: 'is not',
              },
            ]),
      ],
    };
  }

  if (filterToken.filter === FilterType.HAS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={filterToken.key.value}
          keyLabel={operator === TermOperator.NOT_EQUAL ? 'does not have' : 'has'}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: (
            <FilterKeyOperatorLabel
              keyLabel="has"
              keyValue={filterToken.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'has',
        },
        ...(disallowNegation
          ? []
          : [
              {
                value: TermOperator.NOT_EQUAL,
                label: (
                  <FilterKeyOperatorLabel
                    keyLabel="does not have"
                    keyValue={filterToken.key.value}
                    includeKeyLabel
                  />
                ),
                textValue: 'does not have',
              },
            ]),
      ],
    };
  }

  if (filterToken.filter === FilterType.ARRAY_INCLUDES) {
    // Array membership uses the default operator; `[*]` on the key conveys
    // membership and `!` negation reads as "does not include".
    const includesLabel = 'includes';
    const doesNotIncludeLabel = 'does not include';
    const membershipLabel =
      operator === TermOperator.NOT_EQUAL ? doesNotIncludeLabel : includesLabel;

    const regexOps = getValidOpsForFilter({
      filterToken,
      fieldDefinition,
      allowRegexOperators,
    })
      .filter(op => isRegexOperator(op))
      .filter(op => !disallowNegation || !isNegationOperator(op));

    return {
      operator,
      label: (
        <OpLabel>
          {isRegexOperator(operator) ? OP_LABELS[operator] : membershipLabel}
        </OpLabel>
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: <OpLabel>{includesLabel}</OpLabel>,
          textValue: includesLabel,
        },
        ...(disallowNegation
          ? []
          : [
              {
                value: TermOperator.NOT_EQUAL,
                label: <OpLabel>{doesNotIncludeLabel}</OpLabel>,
                textValue: doesNotIncludeLabel,
              },
            ]),
        ...regexOps.map((op): SelectOption<TermOperator> => {
          const optionOpLabel = OP_LABELS[op] ?? op;

          return {
            value: op,
            label: <OpLabel>{optionOpLabel}</OpLabel>,
            textValue: optionOpLabel,
          };
        }),
      ],
    };
  }

  const keyLabel = filterToken.key.text;

  const validOps = getValidOpsForFilter({
    filterToken,
    fieldDefinition,
    allowRegexOperators,
  });

  return {
    operator,
    label: <OpLabel>{OP_LABELS[operator] ?? operator}</OpLabel>,
    options: validOps
      .filter(op => op !== TermOperator.EQUAL)
      .filter(op => !disallowNegation || !isNegationOperator(op))
      .map((op): SelectOption<TermOperator> => {
        const optionOpLabel = OP_LABELS[op] ?? op;

        return {
          value: op,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
          textValue: `${keyLabel} ${optionOpLabel}`,
        };
      }),
  };
}

const OpLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
