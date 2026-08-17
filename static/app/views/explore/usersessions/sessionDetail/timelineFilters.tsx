import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {SearchBar} from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import type {TimelineFilters} from './useSessionDetail';

const TYPE_OPTIONS = SESSION_DATASETS.map(config => ({
  value: config.key,
  label: config.label,
}));

interface Props {
  filters: TimelineFilters;
}

/**
 * Filter row for the session timeline: free text over what the rows show, plus a
 * telemetry-type narrowing. Both write to the URL, so a filtered timeline can be
 * shared as-is.
 */
export function TimelineFilters({filters}: Props) {
  const {query, types, setQuery, setTypes} = filters;

  // The text input filters as you type, but each keystroke would otherwise be a
  // history entry.
  const debouncedSetQuery = useMemo(
    () => debounce(setQuery, DEFAULT_DEBOUNCE_DURATION),
    [setQuery]
  );

  // The default trigger label reads "Log +3", which says less than the state it
  // describes. Naming the interesting cases — everything, one type, or a count —
  // keeps the trigger legible at a glance.
  const typeLabel =
    types.length === TYPE_OPTIONS.length
      ? t('All')
      : types.length === 1
        ? TYPE_OPTIONS.find(option => option.value === types[0])!.label
        : t('%s selected', types.length);

  return (
    <Flex gap="md" align="center" wrap="wrap">
      <Container flex="1 1 240px">
        {containerProps => (
          <SearchBar
            {...containerProps}
            query={query}
            onChange={debouncedSetQuery}
            placeholder={t('Search telemetry by title or detail')}
            aria-label={t('Search telemetry')}
          />
        )}
      </Container>
      <CompactSelect
        multiple
        options={TYPE_OPTIONS}
        value={types}
        onChange={selected => setTypes(selected.map(option => option.value))}
        // Prefixed with the name of the column it narrows, so the pairing is
        // obvious.
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Type')}>
            {typeLabel}
          </OverlayTrigger.Button>
        )}
      />
    </Flex>
  );
}
