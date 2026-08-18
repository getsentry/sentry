import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {Container, Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {SearchBar} from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import type {
  SortDirection,
  TimelineFilters as TimelineFiltersState,
} from './useSessionDetail';

interface Props {
  filters: TimelineFiltersState;
  /** True while the counts are still loading. */
  isPending: boolean;
  /** Every row loaded into the rail, before the filters narrowed it. */
  loadedEvents: number;
  onToggleSort: () => void;
  sortDirection: SortDirection;
  /** How many rows the rail is showing right now. */
  visibleEvents: number;
}

/**
 * The rail's controls: free text over what the rows show, and which end of the
 * session to read from.
 *
 * Telemetry types are not here — those toggle from the scrubber's lane labels,
 * where the label also carries the type's color and its shape over the session.
 * One control per piece of state.
 */
export function TimelineFilters({
  filters,
  sortDirection,
  onToggleSort,
  loadedEvents,
  visibleEvents,
  isPending,
}: Props) {
  const {query, setQuery} = filters;

  // The text input filters as you type, but each keystroke would otherwise be a
  // history entry.
  const debouncedSetQuery = useMemo(
    () => debounce(setQuery, DEFAULT_DEBOUNCE_DURATION),
    [setQuery]
  );

  const loaded = formatAbbreviatedNumber(loadedEvents);

  return (
    <Flex gap="md" align="center" wrap="wrap" padding="md xl">
      {/*
        A readout rather than a pill. It used to sit up in the page header as an
        embossed chip, where it competed with the health and vitals pills for the
        same glance and described something none of them did. Down here it labels
        the list it is counting, next to the controls that narrow it.

        Which is also why it says both numbers once anything is narrowing: beside a
        search box, a single number is read as the number of rows below it.

        Both numbers come from the rail's own rows. Pairing the visible count with
        the session's aggregate total read `53 of 36`, because the trace lane is
        counted as distinct traces while the rail draws one row per segment span,
        and one trace can hold two. The exact per-lane totals are in the swim lane
        labels above, which is where the aggregates belong.
      */}
      <Text size="sm" variant="muted" tabular>
        {isPending
          ? null
          : visibleEvents === loadedEvents
            ? t('%s items', loaded)
            : t('%s of %s items', formatAbbreviatedNumber(visibleEvents), loaded)}
      </Text>

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
