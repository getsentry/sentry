import {type RefObject, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {QueryBuilderFocusType} from 'sentry/components/searchQueryBuilder/types';
import {
  focusIsWithinToken,
  formatFilterValue,
  getValidOpsForFilter,
} from 'sentry/components/searchQueryBuilder/utils';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/valueCombobox';
import {
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type SearchQueryTokenProps = {
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

function useFocusPart(ref: RefObject<HTMLDivElement>, isFocused: boolean) {
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused, ref]);
}

const getOpLabel = (token: TokenResult<Token.FILTER>) => {
  if (token.negated) {
    return OP_LABELS[TermOperator.NOT_EQUAL];
  }

  return OP_LABELS[token.operator] ?? token.operator;
};

function FilterOperator({token}: SearchQueryTokenProps) {
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
        <OpDiv
          {...triggerProps}
          role="gridcell"
          aria-label={t('Edit token operator')}
          onClick={e => {
            triggerProps.onClick?.(e);
            dispatch({type: 'CLICK_TOKEN_OP', token});
          }}
        >
          <InteractionStateLayer />
          {getOpLabel(token)}
        </OpDiv>
      )}
      items={items}
    />
  );
}

function FilterKey({token}: SearchQueryTokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const label = token.key.text;

  // TODO(malwilley): Add edit functionality

  return (
    <KeyDiv tabIndex={-1} role="gridcell" ref={ref} aria-label={t('Edit token key')}>
      <InteractionStateLayer />
      {label}
    </KeyDiv>
  );
}

function FilterValue({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused =
    focus?.type === QueryBuilderFocusType.TOKEN_VALUE && focusIsWithinToken(focus, token);
  const isEditing = isFocused && focus.editing;

  useFocusPart(ref, isFocused);

  if (isEditing) {
    return (
      <ValueDiv>
        <SearchQueryBuilderValueCombobox token={token} />
      </ValueDiv>
    );
  }

  return (
    <ValueDiv
      tabIndex={-1}
      role="gridcell"
      aria-label={t('Edit token value')}
      onClick={() => dispatch({type: 'CLICK_TOKEN_VALUE', token})}
    >
      <InteractionStateLayer />
      {formatFilterValue(token)}
    </ValueDiv>
  );
}

function FilterDelete({token}: SearchQueryTokenProps) {
  const {dispatch} = useSearchQueryBuilder();

  // TODO(malwilley): Add edit functionality

  return (
    <DeleteDiv
      tabIndex={-1}
      role="gridcell"
      aria-label={t('Remove token')}
      onClick={() => dispatch({type: 'DELETE_TOKEN', token})}
    >
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteDiv>
  );
}

export function SearchQueryBuilderFilter({token}: SearchQueryTokenProps) {
  // TODO(malwilley): Add better error messaging
  const tokenHasError = 'invalid' in token && defined(token.invalid);

  return (
    <FilterWrapper
      onClick={e => {
        e.stopPropagation();
      }}
      aria-label={token.text}
      role="row"
      tabIndex={-1}
      data-invalid={tokenHasError}
    >
      <FilterKey token={token} />
      <FilterOperator token={token} />
      <FilterValue token={token} />
      <FilterDelete token={token} />
    </FilterWrapper>
  );
}

const FilterWrapper = styled('div')<{invalid?: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto auto;
  align-items: stretch;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;

  [data-invalid] {
    border-color: ${p => p.theme.red300};
  }
`;

const BaseTokenPart = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  user-select: none;
  cursor: pointer;
`;

const KeyDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.5)} 0 ${space(0.75)};
  border-radius: 3px 0 0 3px;
  border-right: 1px solid transparent;

  :focus,
  :focus-within {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const OpDiv = styled(BaseTokenPart)`
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

const ValueDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.purple400};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  :focus,
  :focus-within {
    background-color: ${p => p.theme.purple100};
    border-left: 1px solid ${p => p.theme.innerBorder};
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DeleteDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.75)} 0 ${space(0.5)};
  border-radius: 0 3px 3px 0;
  color: ${p => p.theme.subText};

  border-left: 1px solid transparent;
  :focus {
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;
