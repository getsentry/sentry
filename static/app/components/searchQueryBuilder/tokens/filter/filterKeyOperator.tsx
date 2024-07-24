import {type ReactNode, useMemo} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {getValidOpsForFilter} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {isDateToken} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type FilterOperatorProps = {
  item: Node<ParseResultToken>;
  onOpenChange: (isOpen: boolean) => void;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
};

const OP_LABELS = {
  [TermOperator.DEFAULT]: 'is',
  [TermOperator.GREATER_THAN]: '>',
  [TermOperator.GREATER_THAN_EQUAL]: '>=',
  [TermOperator.LESS_THAN]: '<',
  [TermOperator.LESS_THAN_EQUAL]: '<=',
  [TermOperator.NOT_EQUAL]: 'is not',
};

const DATE_OP_LABELS = {
  [TermOperator.GREATER_THAN]: 'is after',
  [TermOperator.GREATER_THAN_EQUAL]: 'is on or after',
  [TermOperator.LESS_THAN]: 'is before',
  [TermOperator.LESS_THAN_EQUAL]: 'is on or before',
  [TermOperator.EQUAL]: 'is',
  [TermOperator.DEFAULT]: 'is',
};

const DATE_OPTIONS: TermOperator[] = [
  TermOperator.GREATER_THAN,
  TermOperator.GREATER_THAN_EQUAL,
  TermOperator.LESS_THAN,
  TermOperator.LESS_THAN_EQUAL,
  TermOperator.EQUAL,
];

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

function getTermOperatorFromToken(token: TokenResult<Token.FILTER>) {
  if (token.negated) {
    return TermOperator.NOT_EQUAL;
  }

  return token.operator;
}

function FilterKeyOperatorLabel({
  keyLabel,
  opLabel,
}: {
  keyLabel: string;
  opLabel?: string;
}) {
  return (
    <KeyOpWrapper>
      <span>{keyLabel}</span>
      {opLabel ? <OpLabel>{opLabel}</OpLabel> : null}
    </KeyOpWrapper>
  );
}

function getOperatorInfo(token: TokenResult<Token.FILTER>): {
  label: ReactNode;
  operator: TermOperator;
  options: SelectOption<TermOperator>[];
} {
  if (isDateToken(token)) {
    const keyLabel = token.key.text;
    const operator = getOperatorFromDateToken(token);
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <FilterKeyOperatorLabel keyLabel={keyLabel} opLabel={opLabel} />,
      options: DATE_OPTIONS.map((op): SelectOption<TermOperator> => {
        const optionOpLabel = DATE_OP_LABELS[op] ?? op;

        return {
          value: op,
          textValue: `${keyLabel} ${optionOpLabel}`,
          label: <FilterKeyOperatorLabel keyLabel={keyLabel} opLabel={optionOpLabel} />,
        };
      }),
    };
  }

  const operator = getTermOperatorFromToken(token);

  if (token.filter === FilterType.IS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyLabel={token.key.text}
          opLabel={operator === TermOperator.NOT_EQUAL ? 'not' : undefined}
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel={token.key.text} />,
          textValue: 'is',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: <FilterKeyOperatorLabel keyLabel={token.key.text} opLabel="not" />,
          textValue: 'is not',
        },
      ],
    };
  }

  if (token.filter === FilterType.HAS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyLabel={operator === TermOperator.NOT_EQUAL ? 'does not have' : 'has'}
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel="has" />,
          textValue: 'has',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: <FilterKeyOperatorLabel keyLabel="does not have" />,
          textValue: 'does not have',
        },
      ],
    };
  }

  const keyLabel = token.key.text;
  const opLabel = OP_LABELS[operator] ?? operator;

  return {
    operator,
    label: <FilterKeyOperatorLabel keyLabel={keyLabel} opLabel={opLabel} />,
    options: getValidOpsForFilter(token)
      .filter(op => op !== TermOperator.EQUAL)
      .map((op): SelectOption<TermOperator> => {
        const optionOpLabel = OP_LABELS[op] ?? op;

        return {
          value: op,
          label: <FilterKeyOperatorLabel keyLabel={keyLabel} opLabel={optionOpLabel} />,
          textValue: `${keyLabel} ${optionOpLabel}`,
        };
      }),
  };
}

export function FilterKeyOperator({
  token,
  state,
  item,
  onOpenChange,
}: FilterOperatorProps) {
  const organization = useOrganization();
  const {dispatch, searchSource, query, savedSearchType} = useSearchQueryBuilder();
  const filterButtonProps = useFilterButtonProps({state, item});

  const {operator, label, options} = useMemo(() => getOperatorInfo(token), [token]);

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OpButton
          aria-label={t('Edit operator for filter: %s', token.key.text)}
          {...mergeProps(triggerProps, filterButtonProps)}
        >
          <InteractionStateLayer />
          {label}
        </OpButton>
      )}
      size="sm"
      options={options}
      value={operator}
      onOpenChange={onOpenChange}
      onChange={option => {
        trackAnalytics('search.operator_autocompleted', {
          organization,
          query,
          search_type: savedSearchType === 0 ? 'issues' : 'events',
          search_source: searchSource,
          new_experience: true,
          search_operator: option.value,
          filter_key: token.key.text,
        });
        dispatch({
          type: 'UPDATE_FILTER_OP',
          token,
          op: option.value,
        });
      }}
    />
  );
}

const UnstyledButton = styled('button')`
  background: none;
  border: none;
  outline: none;
  padding: 0;
  user-select: none;

  :focus {
    outline: none;
  }
`;

const OpButton = styled(UnstyledButton)`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-radius: 3px 0 0 3px;

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;

const KeyOpWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const OpLabel = styled('span')`
  color: ${p => p.theme.subText};
`;
