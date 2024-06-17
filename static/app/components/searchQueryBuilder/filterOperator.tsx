import {useMemo} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/useFilterButtonProps';
import {getValidOpsForFilter} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type FilterOperatorProps = {
  item: Node<ParseResultToken>;
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

function getTermOperatorFromToken(token: TokenResult<Token.FILTER>) {
  if (token.negated) {
    return TermOperator.NOT_EQUAL;
  }

  return token.operator;
}

export function FilterOperator({token, state, item}: FilterOperatorProps) {
  const {dispatch} = useSearchQueryBuilder();
  const operator = getTermOperatorFromToken(token);
  const label = OP_LABELS[operator] ?? operator;
  const filterButtonProps = useFilterButtonProps({state, item});

  const options = useMemo<SelectOption<TermOperator>[]>(() => {
    return getValidOpsForFilter(token)
      .filter(op => op !== TermOperator.EQUAL)
      .map(
        (op): SelectOption<TermOperator> => ({
          value: op,
          label: OP_LABELS[op] ?? op,
        })
      );
  }, [token]);

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
      onChange={option => {
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
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.subText};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;
