import {useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';
import {IconClose} from '@sentry/icons/close';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderLayout,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGridItem';
import {
  BaseGridCell,
  FilterWrapper,
} from 'sentry/components/searchQueryBuilder/tokens/components';
import {AggregateKey} from 'sentry/components/searchQueryBuilder/tokens/filter/aggregateKey';
import {FilterKey} from 'sentry/components/searchQueryBuilder/tokens/filter/filterKey';
import {FilterOperator} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {FilterValueText} from 'sentry/components/searchQueryBuilder/tokens/filter/filterValueText';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {isAggregateFilterToken} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {GridInvalidTokenTooltip} from 'sentry/components/searchQueryBuilder/tokens/invalidTokenTooltip';
import {isInvalidFilterKey} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  InvalidReason,
  Token,
  type ParseResultToken,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {isQueryBuilderPanelChrome} from 'sentry/components/tokenizedInput/token/comboBoxLayout';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

interface SearchQueryTokenProps {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
}

interface FilterValueProps extends SearchQueryTokenProps {
  filterRef: React.RefObject<HTMLDivElement | null>;
  onActiveChange: (active: boolean) => void;
}

function FilterValue({token, state, item, filterRef, onActiveChange}: FilterValueProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch, focusOverride} = useSearchQueryBuilderState();
  const {disabled} = useSearchQueryBuilderConfig();
  const {menuPresentation, panelRef, portalTarget} = useSearchQueryBuilderLayout();

  const [editSource, setEditSource] = useState<'click' | 'focusOverride' | false>(false);

  useLayoutEffect(() => {
    if (
      !editSource &&
      focusOverride?.itemKey === item.key &&
      focusOverride.part === 'value'
    ) {
      // oxlint-disable-next-line react/set-state-in-effect
      setEditSource('focusOverride');
      onActiveChange(true);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, editSource, focusOverride, item.key, onActiveChange]);

  const {focusWithinProps} = useFocusWithin({
    onBlurWithin: event => {
      if (
        menuPresentation === 'panel' &&
        event.relatedTarget instanceof Node &&
        isQueryBuilderPanelChrome(event.relatedTarget, panelRef.current, portalTarget)
      ) {
        return;
      }
      setEditSource(false);
    },
  });

  const filterButtonProps = useFilterButtonProps({state, item});

  if (editSource) {
    return (
      <ValueEditing ref={ref} {...mergeProps(focusWithinProps, filterButtonProps)}>
        <SearchQueryBuilderValueCombobox
          token={token}
          wrapperRef={ref}
          editingCommittedValue={editSource === 'click'}
          onDelete={() => {
            filterRef.current?.focus();
            state.selectionManager.setFocusedKey(item.key);
            setEditSource(false);
            onActiveChange(false);
          }}
          onCommit={() => {
            setEditSource(false);
            onActiveChange(false);
            dispatch({type: 'COMMIT_QUERY'});
            // Committing on blur must not move focus back into a dismissed panel.
            if (
              state.collection.getKeyAfter(item.key) &&
              (menuPresentation !== 'panel' ||
                panelRef.current?.contains(document.activeElement))
            ) {
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
      aria-label={t('Edit value for filter: %s', getKeyName(token.key))}
      onClick={() => {
        setEditSource('click');
        onActiveChange(true);
      }}
      disabled={disabled}
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      <FilterValueText token={token} />
    </ValueButton>
  );
}

function FilterDelete({token, state, item}: SearchQueryTokenProps) {
  const {dispatch} = useSearchQueryBuilderState();
  const {disabled} = useSearchQueryBuilderConfig();
  const filterButtonProps = useFilterButtonProps({state, item});

  return (
    <DeleteButton
      aria-label={t('Remove filter: %s', getKeyName(token.key))}
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

export function SearchQueryBuilderFilter({item, state, token}: SearchQueryTokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const isFocused = item.key === state.selectionManager.focusedKey;

  const {dispatch} = useSearchQueryBuilderState();
  const {invalidFilterKeys, invalidFilterKeyMessage, filterKeyAliases} =
    useSearchQueryBuilderConfig();
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

  // oxlint-disable-next-line react/refs
  const modifiedRowProps = mergeProps(rowProps, {
    tabIndex: isFocused ? 0 : -1,
    onKeyDown,
  });

  const hasTokenInvalid =
    'invalid' in token &&
    defined(token.invalid) &&
    !(filterMenuOpen && token.invalid.type === InvalidReason.FILTER_MUST_HAVE_VALUE);
  const tokenHasWarning = 'warning' in token && defined(token.warning);
  const filterKeyName = getKeyName(token.key, {aggregateWithArgs: true});
  const keyIsInvalid = isInvalidFilterKey(token.key, invalidFilterKeys, filterKeyAliases);
  const tokenHasError = hasTokenInvalid || keyIsInvalid;

  return (
    <FilterWrapper
      aria-label={token.text}
      aria-invalid={tokenHasError}
      state={tokenHasError ? 'invalid' : tokenHasWarning ? 'warning' : 'valid'}
      ref={ref}
      {...modifiedRowProps}
    >
      <GridInvalidTokenTooltip
        token={token}
        state={state}
        item={item}
        columnCount={4}
        containerDisplayMode="grid"
        forceVisible={filterMenuOpen ? false : undefined}
        warning={
          keyIsInvalid && !hasTokenInvalid
            ? (invalidFilterKeyMessage ??
              t('Invalid key. "%s" is not a supported search key.', filterKeyName))
            : undefined
        }
      >
        {token.filter === FilterType.IS || token.filter === FilterType.HAS ? null : (
          <BaseGridCell {...gridCellProps}>
            {isAggregateFilterToken(token) ? (
              <AggregateKey
                filterRef={ref}
                item={item}
                token={token}
                state={state}
                onActiveChange={setFilterMenuOpen}
              />
            ) : (
              <FilterKey
                token={token}
                state={state}
                item={item}
                onActiveChange={setFilterMenuOpen}
              />
            )}
          </BaseGridCell>
        )}
        <BaseGridCell {...gridCellProps}>
          <FilterOperator
            token={token}
            state={state}
            item={item}
            onOpenChange={setFilterMenuOpen}
          />
        </BaseGridCell>
        <FilterValueGridCell {...gridCellProps}>
          <FilterValue
            token={token}
            state={state}
            item={item}
            filterRef={ref}
            onActiveChange={setFilterMenuOpen}
          />
        </FilterValueGridCell>
        <BaseGridCell {...gridCellProps}>
          <FilterDelete token={token} state={state} item={item} />
        </BaseGridCell>
      </GridInvalidTokenTooltip>
    </FilterWrapper>
  );
}

const FilterValueGridCell = styled(BaseGridCell)`
  /* When we run out of space, shrink the value */
  min-width: 0;
`;

const ValueButton = styled(UnstyledButton)`
  padding: 0 ${p => p.theme.space['2xs']};
  color: ${p => p.theme.tokens.content.accent};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  width: 100%;
  max-width: 400px;

  :focus {
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const ValueEditing = styled('div')`
  padding: 0 ${p => p.theme.space['2xs']};
  color: ${p => p.theme.tokens.content.accent};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  max-width: 100%;

  :focus-within {
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const DeleteButton = styled(UnstyledButton)`
  padding: 0 ${p => p.theme.space.sm} 0 ${p => p.theme.space.xs};
  border-radius: 0 3px 3px 0;
  color: ${p => p.theme.tokens.content.secondary};
  border-left: 1px solid transparent;

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
