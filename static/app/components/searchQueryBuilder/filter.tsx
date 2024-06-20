import {Fragment, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {FilterOperator} from 'sentry/components/searchQueryBuilder/filterOperator';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/useFilterButtonProps';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import {formatFilterValue, getKeyLabel} from 'sentry/components/searchQueryBuilder/utils';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/valueCombobox';
import {
  type ParseResultToken,
  Token,
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

function FilterKey({token}: {token: TokenResult<Token.FILTER>}) {
  const {keys} = useSearchQueryBuilder();
  const key = token.key.text;
  const tag = keys[key];
  const label = tag ? getKeyLabel(tag) : key;

  return <KeyLabel>{label}</KeyLabel>;
}

function FilterValueText({token}: {token: TokenResult<Token.FILTER>}) {
  switch (token.value.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      const items = token.value.items;
      return (
        <FilterValueList>
          {items.map((item, index) => (
            <Fragment key={index}>
              <span>{formatFilterValue(item.value)}</span>
              {index !== items.length - 1 ? <FilterValueOr>or</FilterValueOr> : null}
            </Fragment>
          ))}
        </FilterValueList>
      );
    default:
      return formatFilterValue(token.value);
  }
}

function FilterValue({token, state, item}: SearchQueryTokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch, focusOverride} = useSearchQueryBuilder();

  const [isEditing, setIsEditing] = useState(false);

  useLayoutEffect(() => {
    if (
      !isEditing &&
      focusOverride?.itemKey === item.key &&
      focusOverride.part === 'value'
    ) {
      setIsEditing(true);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, isEditing, item.key]);

  const {focusWithinProps} = useFocusWithin({
    onBlurWithin: () => {
      setIsEditing(false);
    },
  });

  const filterButtonProps = useFilterButtonProps({state, item});

  if (isEditing) {
    return (
      <ValueEditing ref={ref} {...mergeProps(focusWithinProps, filterButtonProps)}>
        <SearchQueryBuilderValueCombobox
          token={token}
          onCommit={() => {
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
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      <FilterValueText token={token} />
    </ValueButton>
  );
}

function FilterDelete({token, state, item}: SearchQueryTokenProps) {
  const {dispatch} = useSearchQueryBuilder();
  const filterButtonProps = useFilterButtonProps({state, item});

  return (
    <DeleteButton
      aria-label={t('Remove filter: %s', token.key.text)}
      onClick={() => dispatch({type: 'DELETE_TOKEN', token})}
      {...filterButtonProps}
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

      // Only delete if full filter token is focused, otherwise focus it
      if (ref.current === document.activeElement) {
        dispatch({type: 'DELETE_TOKEN', token});
      } else {
        ref.current?.focus();
      }
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
      <BaseTokenPart>
        <FilterKey token={token} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterOperator token={token} state={state} item={item} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterValue token={token} state={state} item={item} />
      </BaseTokenPart>
      <BaseTokenPart {...gridCellProps}>
        <FilterDelete token={token} state={state} item={item} />
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

  &[aria-selected='true'] {
    background-color: ${p => p.theme.blue200};
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

const KeyLabel = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)} 0 ${space(0.75)};
  border-radius: 3px 0 0 3px;
  border-right: 1px solid transparent;

  :focus-within {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
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

const FilterValueList = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const FilterValueOr = styled('span')`
  color: ${p => p.theme.subText};
`;
