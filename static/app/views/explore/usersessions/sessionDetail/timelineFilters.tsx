import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {Container, Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {SearchBar} from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';

import type {
  SortDirection,
  TimelineFilters as TimelineFiltersState,
} from './useSessionDetail';

interface Props {
  filters: TimelineFiltersState;
  onToggleSort: () => void;
  sortDirection: SortDirection;
}

/**
 * The rail's controls: free text over what the rows show, and which end of the
 * session to read from.
 *
 * Telemetry types are not here — those toggle from the scrubber's lane labels,
 * where the label also carries the type's color and its shape over the session.
 * One control per piece of state.
 */
export function TimelineFilters({filters, sortDirection, onToggleSort}: Props) {
  const {query, setQuery} = filters;

  // The text input filters as you type, but each keystroke would otherwise be a
  // history entry.
  const debouncedSetQuery = useMemo(
    () => debounce(setQuery, DEFAULT_DEBOUNCE_DURATION),
    [setQuery]
  );

  return (
    <Flex gap="md" align="center" wrap="wrap" padding="md xl">
      <Container flex="1 1 220px">
        {containerProps => (
          <SearchBar
            {...containerProps}
            query={query}
            onChange={debouncedSetQuery}
            placeholder={t('Search telemetry by title or detail')}
            aria-label={t('Search telemetry')}
            size="sm"
          />
        )}
      </Container>

      {/*
        The sort is not only a display order: it decides which end of a truncated
        session the per-dataset row queries return, so it has to stay explicit now
        that there is no column header to click.
      */}
      <SegmentedControl
        size="sm"
        aria-label={t('Timeline order')}
        value={sortDirection}
        onChange={value => {
          if (value !== sortDirection) {
            onToggleSort();
          }
        }}
      >
        <SegmentedControl.Item key="asc">{t('Oldest first')}</SegmentedControl.Item>
        <SegmentedControl.Item key="desc">{t('Newest first')}</SegmentedControl.Item>
      </SegmentedControl>
    </Flex>
  );
}
