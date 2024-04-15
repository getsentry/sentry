import {type RefObject, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  SearchQueryKeyBuilder,
  SearchQueryValueBuilder,
} from 'sentry/components/searchQueryBuilder/searchQueryBuilderCombobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/searchQueryBuilderContext';
import type {
  QueryBuilderToken,
  QueryBuilderTokenWithKey,
} from 'sentry/components/searchQueryBuilder/types';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type SearchQueryTokenProps = {
  token: QueryBuilderToken;
};

const OPS = {
  '': 'is',
  '>': '>',
  '<': '<',
};

const getOperatorLabel = (op?: string) => OPS[op ?? ''] ?? op;

function useFocusPart(ref: RefObject<HTMLDivElement>, isFocused: boolean) {
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused, ref]);
}

function hasKey(token: QueryBuilderToken): token is QueryBuilderTokenWithKey {
  return token.key !== undefined;
}

function Operator({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = focus?.part === 'op' && focus.tokenId === token.id;

  useFocusPart(ref, isFocused);

  // TODO: Add support for negated operations
  const items: MenuItemProps[] = useMemo(() => {
    return Object.entries(OPS).map(([value, label]) => ({
      key: value,
      label,
      onAction: val =>
        dispatch({type: 'UPDATE_TOKEN', id: token.id, token: {operator: val}}),
    }));
  }, [dispatch, token.id]);

  if (!hasKey(token)) {
    return null;
  }

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
          {OPS[token.operator] ?? token.operator}
        </OpDiv>
      )}
      items={items}
    />
  );
}

function SearchQueryTokenKey({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = focus?.part === 'key' && focus.tokenId === token.id;
  const isEditing = isFocused && focus.editing;
  const label = token?.key;

  useFocusPart(ref, isFocused);

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
      onClick={() => dispatch({type: 'CLICK_TOKEN_PART', token, part: 'key'})}
      aria-label={t('Edit token key')}
    >
      <InteractionStateLayer />
      {label}
    </KeyDiv>
  );
}

function SearchQueryTokenValue({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = focus?.part === 'value' && focus.tokenId === token.id;
  const isEditing = isFocused && focus.editing;

  useFocusPart(ref, isFocused);

  if (!hasKey(token)) {
    return null;
  }

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
      onClick={() => dispatch({type: 'CLICK_TOKEN_PART', token, part: 'value'})}
      aira-label={t('Edit token value')}
    >
      <InteractionStateLayer />
      {/* TODO: Multiple values */}
      {!token.value
        ? ''
        : typeof token.value === 'string'
          ? token.value
          : token.value.join(', ')}
    </ValueDiv>
  );
}

function SearchQueryTokenDelete({token}: SearchQueryTokenProps) {
  const {focus, dispatch} = useSearchQueryBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = focus?.part === 'delete' && focus.tokenId === token.id;

  useFocusPart(ref, isFocused);

  if (!token.value) {
    return null;
  }

  return (
    <RemoveDiv
      tabIndex={-1}
      role="gridcell"
      ref={ref}
      onClick={() => dispatch({type: 'DELETE_TOKEN', tokenId: token.id})}
      aria-label={t('Remove token')}
    >
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </RemoveDiv>
  );
}

export function SearchQueryToken({token}: SearchQueryTokenProps) {
  const {focus} = useSearchQueryBuilder();

  const isEditing = focus?.editing === true && focus?.tokenId === token.id;
  const unrealized = !token.key || !token.value;

  if (!token.key && !isEditing) {
    return null;
  }

  const label = unrealized
    ? t('Uncompleted token')
    : `${token.key} ${getOperatorLabel(token.operator)} ${token.value}`;

  return (
    <Token
      onClick={e => {
        e.stopPropagation();
      }}
      invalid={unrealized && !isEditing}
      aria-label={label}
      role="row"
      tabIndex={-1}
    >
      <SearchQueryTokenKey token={token} />
      <Operator token={token} />
      <SearchQueryTokenValue token={token} />
      <SearchQueryTokenDelete token={token} />
    </Token>
  );
}

const Token = styled('div')<{invalid?: boolean}>`
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
