import {type RefObject, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  SearchQueryKeyBuilder,
  SearchQueryValueBuilder,
} from 'sentry/components/searchQueryBuilder/searchQueryBuilderCombobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/searchQueryBuilderContext';
import {QueryBuilderFocusType} from 'sentry/components/searchQueryBuilder/types';
import {focusIsWithinToken} from 'sentry/components/searchQueryBuilder/utils';
import {
  filterTypeConfig,
  interchangeableFilterOperators,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

const getOpLabel = (token: TokenResult<Token.FILTER>) => {
  if (token.negated) {
    return OP_LABELS[TermOperator.NOT_EQUAL];
  }

  return OP_LABELS[token.operator] ?? token.operator;
};

function getValidOps(filterToken: TokenResult<Token.FILTER>): readonly TermOperator[] {
  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  return [...validOps];
}

function useFocusPart(ref: RefObject<HTMLDivElement>, isFocused: boolean) {
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused, ref]);
}

function Operator({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused =
    focus?.type === QueryBuilderFocusType.TOKEN_OP && focusIsWithinToken(focus, token);

  useFocusPart(ref, isFocused);

  // TODO: Add support for negated operations
  const items: MenuItemProps[] = useMemo(() => {
    return getValidOps(token).map(op => ({
      key: `op-${op}`,
      label: OP_LABELS[op] ?? op,
      onAction: val => {
        dispatch({
          type: 'UPDATE_TOKEN_OP',
          token,
          op: val.replace('op-', '') as TermOperator,
        });
      },
    }));
  }, [dispatch, token]);

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OpDiv
          tabIndex={-1}
          role="gridcell"
          aria-label={t('Edit token operator')}
          {...triggerProps}
        >
          <InteractionStateLayer />
          {getOpLabel(token)}
        </OpDiv>
      )}
      items={items}
    />
  );
}

function SearchQueryTokenKey({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused =
    focus?.type === QueryBuilderFocusType.TOKEN_KEY && focusIsWithinToken(focus, token);
  const isEditing = isFocused && focus.editing;

  useFocusPart(ref, isFocused);

  const label = token.key.text;

  if (isEditing) {
    return (
      <KeyDiv>
        <SearchQueryKeyBuilder token={token} placeholder={label ?? ''} />
      </KeyDiv>
    );
  }

  return (
    <KeyDiv
      tabIndex={-1}
      role="gridcell"
      ref={ref}
      onClick={() => dispatch({type: 'CLICK_TOKEN_KEY', token: token.key})}
      aria-label={t('Edit token key')}
    >
      <InteractionStateLayer />
      {token.key.text}
    </KeyDiv>
  );
}

function SearchQueryTokenValue({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused =
    focus?.type === QueryBuilderFocusType.TOKEN_VALUE && focusIsWithinToken(focus, token);
  const isEditing = isFocused && focus.editing;

  useFocusPart(ref, isFocused);

  if (isEditing) {
    return (
      <ValueDiv>
        <SearchQueryValueBuilder token={token} />
      </ValueDiv>
    );
  }

  return (
    <ValueDiv
      tabIndex={-1}
      role="gridcell"
      onClick={() => dispatch({type: 'CLICK_TOKEN_VALUE', token})}
      aira-label={t('Edit token value')}
    >
      <InteractionStateLayer />
      {token.value.text}
    </ValueDiv>
  );
}

function SearchQueryTokenDelete({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused =
    focus?.type === QueryBuilderFocusType.TOKEN_DELETE &&
    focusIsWithinToken(focus, token);

  useFocusPart(ref, isFocused);

  if (!token.value) {
    return null;
  }

  return (
    <RemoveDiv
      tabIndex={-1}
      role="gridcell"
      ref={ref}
      onClick={() => dispatch({type: 'DELETE_TOKEN', token})}
      aria-label={t('Remove token')}
    >
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </RemoveDiv>
  );
}

export function SearchQueryToken({token}: SearchQueryTokenProps) {
  const {focus} = useSearchQueryBuilder();

  const isEditing = focusIsWithinToken(focus, token);

  return (
    <TokenWrapper
      onClick={e => {
        e.stopPropagation();
      }}
      invalid={'invalid' in token && !isEditing}
      aria-label={token.text}
      role="row"
      tabIndex={-1}
    >
      <SearchQueryTokenKey token={token} />
      <Operator token={token} />
      <SearchQueryTokenValue token={token} />
      <SearchQueryTokenDelete token={token} />
    </TokenWrapper>
  );
}

const TokenWrapper = styled('div')<{invalid?: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto auto;
  align-items: stretch;
  border: 1px solid ${p => (p.invalid ? p.theme.red300 : p.theme.innerBorder)};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;
`;

// const UnrealizedToken = styled(Token)`
//   border: 1px solid transparent;

//   &::after {
//     content: '';
//     position: absolute;
//     top: 0;
//     right: 0;
//     bottom: 0;
//     left: 0;
//     border: 1px solid ${p => p.theme.innerBorder};
//     border-radius: ${p => p.theme.borderRadius};
//     mask-image: linear-gradient(to right, black, transparent);
//   }
// `;

const BaseTokenPart = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  user-select: none;

  :not(:last-child) {
    border-right: 1px solid transparent;
  }
  :not(:first-child) {
    border-left: 1px solid transparent;
  }

  :focus,
  :focus-within {
    background-color: ${p => p.theme.translucentGray100};

    :not(:last-child) {
      border-right: 1px solid ${p => p.theme.innerBorder};
    }

    :not(:first-child) {
      border-left: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;

const KeyDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.5)} 0 ${space(0.75)};
  border-radius: 3px 0 0 3px;
`;
const OpDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.subText};
  height: 100%;
`;
const ValueDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.purple400};

  &:focus-within {
    background-color: ${p => p.theme.purple100};
  }
`;

const RemoveDiv = styled(BaseTokenPart)`
  padding: 0 ${space(0.75)} 0 ${space(0.5)};
  border-radius: 0 3px 3px 0;
  color: ${p => p.theme.subText};
`;
