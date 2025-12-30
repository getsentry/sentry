import {useRef, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGridItem';
import {
  BaseGridCell,
  FilterWrapper,
} from 'sentry/components/searchQueryBuilder/tokens/components';
import {DeletableToken} from 'sentry/components/searchQueryBuilder/tokens/deletableToken';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {GridInvalidTokenTooltip} from 'sentry/components/searchQueryBuilder/tokens/invalidTokenTooltip';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

type SearchQueryBuilderBooleanProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.LOGIC_BOOLEAN>;
};

export function SearchQueryBuilderBoolean({
  item,
  state,
  token,
}: SearchQueryBuilderBooleanProps) {
  const showBooleanOpSelector = useOrganization().features.includes(
    'search-query-builder-add-boolean-operator-select'
  );

  if (showBooleanOpSelector) {
    return <SearchQueryBuilderBooleanSelect item={item} state={state} token={token} />;
  }

  return <SearchQueryBuilderBooleanDeletable item={item} state={state} token={token} />;
}

function SearchQueryBuilderBooleanDeletable({
  item,
  state,
  token,
}: SearchQueryBuilderBooleanProps) {
  return (
    <DeletableToken
      item={item}
      state={state}
      token={token}
      label={token.value}
      invalid={token.invalid}
    >
      {token.text}
    </DeletableToken>
  );
}

function FilterDelete({token, state, item}: SearchQueryBuilderBooleanProps) {
  const {dispatch, disabled} = useSearchQueryBuilder();
  const filterButtonProps = useFilterButtonProps({state, item});

  return (
    <DeleteButton
      aria-label={t('Remove logic operator: %s', token.text)}
      onClick={() => {
        dispatch({type: 'DELETE_TOKEN', token});
      }}
      disabled={disabled}
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

const LOGIC_OPERATOR_OPTIONS = [
  {value: 'AND', label: 'AND'},
  {value: 'OR', label: 'OR'},
];

function SearchQueryBuilderBooleanSelect({
  item,
  state,
  token,
}: SearchQueryBuilderBooleanProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const {disabled, dispatch} = useSearchQueryBuilder();
  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);
  const {focusWithinProps} = useFocusWithin({});
  const filterButtonProps = useFilterButtonProps({state, item});

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
    tabIndex: item.key === state.selectionManager.focusedKey ? 0 : -1,
    onKeyDown,
  });

  // sending this to uppercase to match the options as `and` and `or` are also valid
  // values for the boolean operator
  const tokenText = token.text.toUpperCase();

  const tokenHasError = 'invalid' in token && defined(token.invalid);
  const tokenHasWarning = 'warning' in token && defined(token.warning);

  return (
    <FilterWrapper
      ref={ref}
      aria-label={token.text}
      aria-invalid={tokenHasError}
      state={tokenHasWarning ? 'warning' : tokenHasError ? 'invalid' : 'valid'}
      {...modifiedRowProps}
    >
      <GridInvalidTokenTooltip
        columnCount={2}
        token={token}
        state={state}
        item={item}
        containerDisplayMode="grid"
        forceVisible={filterMenuOpen ? false : undefined}
      >
        <BaseGridCell {...gridCellProps}>
          <CompactSelect
            disabled={disabled}
            size="sm"
            value={tokenText}
            options={LOGIC_OPERATOR_OPTIONS}
            trigger={triggerProps => {
              return (
                // @ts-expect-error we don't allow arbitrary buttons as triggers
                <OpButton
                  disabled={disabled}
                  aria-label={t('Edit logic operator: %s', tokenText)}
                  {...mergeProps(triggerProps, filterButtonProps, focusWithinProps)}
                >
                  <InteractionStateLayer />
                  {tokenText}
                </OpButton>
              );
            }}
            onOpenChange={setFilterMenuOpen}
            onChange={option => {
              dispatch({type: 'UPDATE_LOGIC_OPERATOR', token, value: option.value});
            }}
          />
        </BaseGridCell>
        <BaseGridCell {...gridCellProps}>
          <FilterDelete token={token} state={state} item={item} />
        </BaseGridCell>
      </GridInvalidTokenTooltip>
    </FilterWrapper>
  );
}

const OpButton = styled(UnstyledButton, {shouldForwardProp: isPropValid})`
  padding: 0 ${p => p.theme.space['2xs']} 0 ${p => p.theme.space.xs};
  color: ${p => p.theme.subText};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-radius: 3px 0 0 3px;

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DeleteButton = styled(UnstyledButton)`
  padding: 0 ${p => p.theme.space.sm} 0 ${p => p.theme.space.xs};
  border-radius: 0 3px 3px 0;
  color: ${p => p.theme.subText};
  border-left: 1px solid transparent;

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;
