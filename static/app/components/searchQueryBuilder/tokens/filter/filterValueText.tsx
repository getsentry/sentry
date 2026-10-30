import {Fragment, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {DateTime} from 'sentry/components/dateTime';
import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderLayout,
} from 'sentry/components/searchQueryBuilder/context';
import {renderRegexPattern} from 'sentry/components/searchQueryBuilder/tokens/filter/highlightedRegexPattern';
import {RegexDelimiter} from 'sentry/components/searchQueryBuilder/tokens/filter/regexDelimiter';
import {
  formatFilterValue,
  getFilterValueType,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {FilterType, Token, type TokenResult} from 'sentry/components/searchSyntax/parser';
import {getKeyName, isRegexOperator} from 'sentry/components/searchSyntax/utils';
import {prettifyTagKey} from 'sentry/utils/fields';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

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

  const previousWidth = element.style.width;
  const fallback = ellipsizeFilterValue(value, fallbackMaxLength, multi);

  // Detaching and reattaching the same nodes keeps the references React holds valid.
  // Writing `element.textContent` instead would destroy any rendered child elements.
  const children = Array.from(element.childNodes);
  const measureNode = document.createTextNode(value);

  try {
    // Expand to the full value first so content-sized ancestors can grow up to their
    // max-width when the window/search bar is no longer constraining them.
    element.replaceChildren(measureNode);
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
    measureNode.data = ELLIPSIS;
    let best = element.scrollWidth <= availableWidth ? ELLIPSIS : '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = ellipsizeFilterValue(value, mid, multi);
      measureNode.data = candidate;
      if (element.scrollWidth <= availableWidth) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  } finally {
    element.replaceChildren(...children);
    element.style.width = previousWidth;
  }
}

function TruncatedFilterDisplayValue({
  value,
  fallbackMaxLength,
  multi = false,
  maxWidth,
  renderValue,
}: {
  fallbackMaxLength: number;
  value: string;
  maxWidth?: string;
  multi?: boolean;
  renderValue?: (displayValue: string) => React.ReactNode;
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
      // oxlint-disable-next-line react/todo
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
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [value, fallbackMaxLength, multi]);

  const Truncated = multi ? FilterMultiValueTruncated : FilterValueSingleTruncatedValue;

  return (
    <Truncated
      ref={ref}
      maxWidth={maxWidth}
      data-overflowing={displayValue === value ? undefined : 'true'}
    >
      {renderValue ? renderValue(displayValue) : displayValue}
    </Truncated>
  );
}

export function FilterValueText({token}: {token: TokenResult<Token.FILTER>}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const {size, showAllFilterValues} = useSearchQueryBuilderLayout();
  const valueType = getFilterValueType(token, getFieldDefinition(getKeyName(token.key)));

  if (token.filter === FilterType.HAS) {
    return (
      <TruncatedFilterDisplayValue
        value={prettifyTagKey(token.value.text)}
        fallbackMaxLength={FILTER_VALUE_FALLBACK_MAX_LENGTH}
      />
    );
  }

  if (isRegexOperator(token.operator)) {
    return (
      <Flex align="center" minWidth="0" width="100%">
        <RegexDelimiter paddingRight="2xs" />
        <TruncatedFilterDisplayValue
          value={formatFilterValue({token: token.value, valueType})}
          fallbackMaxLength={FILTER_VALUE_FALLBACK_MAX_LENGTH}
          renderValue={renderRegexPattern}
        />
        <RegexDelimiter />
      </Flex>
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

      const maxItems = showAllFilterValues ? items.length : size === 'small' ? 1 : 3;

      // When every value shows, a value and the joiner after it wrap as one
      // unit, so a line never starts with a dangling "or".
      const values = items.slice(0, maxItems).map((item, index) => {
        const value = (
          <TruncatedFilterDisplayValue
            value={formatFilterValue({token: item.value!, valueType})}
            fallbackMaxLength={
              showAllFilterValues
                ? FILTER_VALUE_FALLBACK_MAX_LENGTH
                : FILTER_MULTI_VALUE_FALLBACK_MAX_LENGTH
            }
            maxWidth={showAllFilterValues ? '100%' : undefined}
            multi
          />
        );
        const joiner =
          index !== items.length - 1 && index < maxItems - 1 ? (
            <FilterValueJoiner> {multiValueJoiner} </FilterValueJoiner>
          ) : null;

        return showAllFilterValues ? (
          <Flex key={index} align="center" gap="xs" minWidth="0" maxWidth="100%">
            {value}
            {joiner}
          </Flex>
        ) : (
          <Fragment key={index}>
            {value}
            {joiner}
          </Fragment>
        );
      });

      return (
        <Flex
          align="center"
          wrap={showAllFilterValues ? 'wrap' : 'nowrap'}
          gap="xs"
          maxWidth={showAllFilterValues ? undefined : '400px'}
        >
          {values}
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

const FilterValueJoiner = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  /* Offset the preceding value's clipping allowance without affecting the
   * trailing space before the next value. */
  margin-inline-start: -2px;
`;

const FilterMultiValueTruncated = styled('div')<{maxWidth?: string}>`
  display: block;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  padding-inline-end: 2px;
  max-width: ${p => p.maxWidth ?? '110px'};
  width: fit-content;
  min-width: 0;
`;

const FilterValueSingleTruncatedValue = styled('div')<{maxWidth?: string}>`
  display: block;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  padding-inline-end: 2px;
  max-width: ${p => p.maxWidth ?? '100%'};
  width: 100%;
  min-width: 0;
`;
