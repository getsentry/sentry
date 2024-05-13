import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import {
  formatFilterValue,
  getValidOpsForFilter,
} from 'sentry/components/searchQueryBuilder/utils';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/valueCombobox';
import {
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type SearchQueryTokenProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
};

type FilterPartProps = {
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

const getOpLabel = (token: TokenResult<Token.FILTER>) => {
  if (token.negated) {
    return OP_LABELS[TermOperator.NOT_EQUAL];
  }

  return OP_LABELS[token.operator] ?? token.operator;
};

function FilterOperator({token}: FilterPartProps) {
  const {dispatch} = useSearchQueryBuilder();

  const items: MenuItemProps[] = useMemo(() => {
    return getValidOpsForFilter(token).map(op => ({
      key: op,
      label: OP_LABELS[op] ?? op,
      onAction: val => {
        dispatch({
          type: 'UPDATE_FILTER_OP',
          token,
          op: val as TermOperator,
        });
      },
    }));
  }, [dispatch, token]);

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OpButton
          aria-label={t('Edit operator for filter: %s', token.key.text)}
          {...triggerProps}
        >
          <InteractionStateLayer />
          {getOpLabel(token)}
        </OpButton>
      )}
      items={items}
    />
  );
}

function FilterKey({token}: FilterPartProps) {
  const label = token.key.text;

  // TODO(malwilley): Add edit functionality

  return (
    <KeyButton aria-label={t('Edit filter key: %s', label)} onClick={() => {}}>
      <InteractionStateLayer />
      {label}
    </KeyButton>
  );
}

function FilterValue({token, state, item}: SearchQueryTokenProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);

  if (!token.value.text && !isEditing) {
    setIsEditing(true);
  }

  const {focusWithinProps} = useFocusWithin({
    onBlurWithin: () => {
      setIsEditing(false);
    },
  });

  if (isEditing) {
    return (
      <ValueEditing ref={ref} {...focusWithinProps}>
        <SearchQueryBuilderValueCombobox
          token={token}
          onChange={() => {
            setIsEditing(false);
            if (state.collection.getKeyAfter(item.key)) {
              state.selectionManager.setFocusedKey(
                state.collection.getKeyAfter(item.key)
              );
            }
          }}
        />
      </ValueEditing>
    );
  }

  return (
    <ValueButton
      aria-label={t('Edit value for filter: %s', token.key.text)}
      onClick={() => setIsEditing(true)}
    >
      <InteractionStateLayer />
      {formatFilterValue(token)}
    </ValueButton>
  );
}

function FilterDelete({token}: FilterPartProps) {
  const {dispatch} = useSearchQueryBuilder();

  return (
    <DeleteButton
      aria-label={t('Remove filter: %s', token.key.text)}
      onClick={() => dispatch({type: 'DELETE_TOKEN', token})}
    >
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

export function SearchQueryBuilderFilter({item, state, token}: SearchQueryTokenProps) {
  const ref = useRef<HTMLDivElement>(null);

  const isFocused = item.key === state.selectionManager.focusedKey;

  const {dispatch} = useSearchQueryBuilder();
  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      dispatch({type: 'DELETE_TOKEN', token});
    }
  };

  const modifiedRowProps = mergeProps(rowProps, {
    tabIndex: isFocused ? 0 : -1,
    onKeyDown,
  });

  // TODO(malwilley): Add better error messaging
  const tokenHasError = 'invalid' in token && defined(token.invalid);

  return (
    <FilterWrapper
      aria-label={token.text}
      data-invalid={tokenHasError}
      ref={ref}
      {...modifiedRowProps}
    >
      <BaseTokenPart {...gridCellProps}>
        <FilterKey token={token} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterOperator token={token} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterValue token={token} state={state} item={item} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterDelete token={token} />
      </BaseTokenPart>
    </FilterWrapper>
  );
}

const FilterWrapper = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto auto;
  align-items: stretch;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;

  :focus {
    background-color: ${p => p.theme.gray100};
    outline: none;
  }
`;

const BaseTokenPart = styled('div')`
  display: flex;
  align-items: stretch;
  position: relative;
`;

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

const KeyButton = styled(UnstyledButton)`
  padding: 0 ${space(0.5)} 0 ${space(0.75)};
  border-radius: 3px 0 0 3px;
  border-right: 1px solid transparent;

  :focus-within {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
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

const ValueButton = styled(UnstyledButton)`
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.purple400};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  :focus {
    background-color: ${p => p.theme.purple100};
    border-left: 1px solid ${p => p.theme.innerBorder};
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const ValueEditing = styled('div')`
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.purple400};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  :focus-within {
    background-color: ${p => p.theme.purple100};
    border-left: 1px solid ${p => p.theme.innerBorder};
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DeleteButton = styled(UnstyledButton)`
  padding: 0 ${space(0.75)} 0 ${space(0.5)};
  border-radius: 0 3px 3px 0;
  color: ${p => p.theme.subText};
  border-left: 1px solid transparent;

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;
