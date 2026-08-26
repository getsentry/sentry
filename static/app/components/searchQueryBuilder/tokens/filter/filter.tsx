import {Fragment, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';

import {DateTime} from 'sentry/components/dateTime';
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
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {
  formatFilterValue,
  getFilterValueType,
  isAggregateFilterToken,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {GridInvalidTokenTooltip} from 'sentry/components/searchQueryBuilder/tokens/invalidTokenTooltip';
import {isInvalidFilterKey} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  Token,
  type ParseResultToken,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {prettifyTagKey} from 'sentry/utils/fields';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

interface SearchQueryTokenProps {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
}

interface FilterValueProps extends SearchQueryTokenProps {
  filterRef: React.RefObject<HTMLDivElement | null>;
  onActiveChange: (active: boolean) => void;
}

const FILTER_VALUE_ELLIPSIS_DELIMITER = /[\s\-:/]/;
const FILTER_VALUE_FALLBACK_MAX_LENGTH = 40;
const FILTER_MULTI_VALUE_FALLBACK_MAX_LENGTH = 20;
const ELLIPSIS = '\u2026';

function ellipsizeFilterValue(value: string, maxLength: number, multi: boolean): string {
  if (!multi) {
    return middleEllipsis(value, maxLength, FILTER_VALUE_ELLIPSIS_DELIMITER);
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 2) {
    return `${value.slice(0, Math.max(0, maxLength - 1))}${ELLIPSIS}`;
  }

  const visibleLength = maxLength - 1;
  const prefixLength = Math.ceil(visibleLength / 2);
  const suffixLength = Math.floor(visibleLength / 2);
  return `${value.slice(0, prefixLength)}${ELLIPSIS}${value.slice(-suffixLength)}`;
}

/**
 * Fit middle-ellipsis to the element's available width.
 *
 * Always starts from the full value so that when the constraint loosens
 * (e.g. the window grows), content can reclaim width before we measure.
 */
function fitMiddleEllipsisToElement(
  value: string,
  fallbackMaxLength: number,
  element: HTMLElement,
  multi: boolean
): string {
  if (value.length <= 0) {
    return value;
  }

  const previousText = element.textContent;
  const previousWidth = element.style.width;
  const fallback = ellipsizeFilterValue(value, fallbackMaxLength, multi);

  try {
    // Expand to the full value first so content-sized ancestors can grow up to their
    // max-width when the window/search bar is no longer constraining them.
    element.textContent = value;
    element.style.width = '';

    if (element.clientWidth <= 0) {
      return fallback;
    }

    if (element.scrollWidth <= element.clientWidth) {
      return value;
    }

    // Lock and reuse the constrained width so temporary candidate text cannot
    // collapse a flex item during the search. Since these dimensions are
    // integer-rounded, the styled end padding keeps glyphs away from the
    // trailing clipping edge.
    const availableWidth = element.clientWidth;
    element.style.width = `${availableWidth}px`;

    let low = 1;
    let high = value.length;
    element.textContent = ELLIPSIS;
    let best = element.scrollWidth <= availableWidth ? ELLIPSIS : '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = ellipsizeFilterValue(value, mid, multi);
      element.textContent = candidate;
      if (element.scrollWidth <= availableWidth) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  } finally {
    element.textContent = previousText;
    element.style.width = previousWidth;
  }
}

function TruncatedFilterDisplayValue({
  value,
  fallbackMaxLength,
  multi = false,
}: {
  fallbackMaxLength: number;
  value: string;
  multi?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(() =>
    ellipsizeFilterValue(value, fallbackMaxLength, multi)
  );

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let isFitting = false;
    const update = () => {
      if (isFitting) {
        return;
      }
      isFitting = true;
      try {
        const next = fitMiddleEllipsisToElement(value, fallbackMaxLength, element, multi);
        setDisplayValue(prev => (prev === next ? prev : next));
      } finally {
        isFitting = false;
      }
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    // Observe the search bar (or viewport) — not the value itself. After
    // truncating the chip is content-sized, so it won't grow on window expand
    // unless we re-fit from an ancestor that actually resized.
    const observed =
      element.closest('[data-test-id="search-query-builder"]') ??
      document.documentElement;

    const observer = new ResizeObserver(update);
    observer.observe(observed);
    return () => observer.disconnect();
  }, [value, fallbackMaxLength, multi]);

  const Truncated = multi ? FilterMultiValueTruncated : FilterValueSingleTruncatedValue;

  return (
    <Truncated ref={ref} data-overflowing={displayValue === value ? undefined : 'true'}>
      {displayValue}
    </Truncated>
  );
}

export function FilterValueText({token}: {token: TokenResult<Token.FILTER>}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const {size} = useSearchQueryBuilderLayout();
  const valueType = getFilterValueType(token, getFieldDefinition(getKeyName(token.key)));

  if (token.filter === FilterType.HAS) {
    return (
      <TruncatedFilterDisplayValue
        value={prettifyTagKey(token.value.text)}
        fallbackMaxLength={FILTER_VALUE_FALLBACK_MAX_LENGTH}
      />
    );
  }

  switch (token.value.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST: {
      const items = token.value.items;
      const multiValueJoiner = token.negated ? 'and' : 'or';

      if (items.length === 1 && items[0]!.value) {
        return (
          <TruncatedFilterDisplayValue
            value={formatFilterValue({token: items[0]!.value, valueType})}
            fallbackMaxLength={FILTER_VALUE_FALLBACK_MAX_LENGTH}
          />
        );
      }

      const maxItems = size === 'small' ? 1 : 3;

      return (
        <Flex align="center" wrap="nowrap" gap="xs" maxWidth="400px">
          {items.slice(0, maxItems).map((item, index) => (
            <Fragment key={index}>
              <TruncatedFilterDisplayValue
                value={formatFilterValue({token: item.value!, valueType})}
                fallbackMaxLength={FILTER_MULTI_VALUE_FALLBACK_MAX_LENGTH}
                multi
              />
              {index !== items.length - 1 && index < maxItems - 1 ? (
                <FilterValueJoiner> {multiValueJoiner} </FilterValueJoiner>
              ) : null}
            </Fragment>
          ))}
          {items.length > maxItems && <span>+{items.length - maxItems}</span>}
        </Flex>
      );
    }
    case Token.VALUE_ISO_8601_DATE: {
      const isUtc = token.value.tz?.toLowerCase() === 'z' || !token.value.tz;

      return (
        <DateTime date={token.value.value} dateOnly={!token.value.time} utc={isUtc} />
      );
    }
    default: {
      return (
        <TruncatedFilterDisplayValue
          value={formatFilterValue({token: token.value, valueType})}
          fallbackMaxLength={FILTER_VALUE_FALLBACK_MAX_LENGTH}
        />
      );
    }
  }
}

function FilterValue({token, state, item, filterRef, onActiveChange}: FilterValueProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch, focusOverride} = useSearchQueryBuilderState();
  const {disabled} = useSearchQueryBuilderConfig();

  const [isEditing, setIsEditing] = useState(false);

  useLayoutEffect(() => {
    if (
      !isEditing &&
      focusOverride?.itemKey === item.key &&
      focusOverride.part === 'value'
    ) {
      setIsEditing(true);
      onActiveChange(true);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, isEditing, item.key, onActiveChange]);

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
          wrapperRef={ref}
          onDelete={() => {
            filterRef.current?.focus();
            state.selectionManager.setFocusedKey(item.key);
            setIsEditing(false);
            onActiveChange(false);
          }}
          onCommit={() => {
            setIsEditing(false);
            onActiveChange(false);
            dispatch({type: 'COMMIT_QUERY'});
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
      aria-label={t('Edit value for filter: %s', getKeyName(token.key))}
      onClick={() => {
        setIsEditing(true);
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
  const {invalidFilterKeys, invalidFilterKeyMessage} = useSearchQueryBuilderConfig();
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

  const hasTokenInvalid = 'invalid' in token && defined(token.invalid);
  const tokenHasWarning = 'warning' in token && defined(token.warning);
  const filterKeyName = getKeyName(token.key, {aggregateWithArgs: true});
  const keyIsInvalid = isInvalidFilterKey(token.key, invalidFilterKeys);
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

const FilterValueJoiner = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  /* Offset the preceding value's clipping allowance without affecting the
   * trailing space before the next value. */
  margin-inline-start: -2px;
`;

const FilterMultiValueTruncated = styled('div')`
  display: block;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  padding-inline-end: 2px;
  max-width: 110px;
  width: fit-content;
  min-width: 0;
`;

const FilterValueSingleTruncatedValue = styled('div')`
  display: block;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  padding-inline-end: 2px;
  max-width: 100%;
  width: 100%;
  min-width: 0;
`;
