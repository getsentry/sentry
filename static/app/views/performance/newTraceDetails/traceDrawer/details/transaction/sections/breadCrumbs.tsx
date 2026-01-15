import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BreadcrumbTimeDisplay,
  getEnhancedBreadcrumbs,
  useBreadcrumbFilters,
} from 'sentry/components/events/breadcrumbs/utils';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {IconFilter, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

const MAX_BREADCRUMBS_HEIGHT = 400;

export function BreadCrumbs({event}: {event: EventTransaction}) {
  const theme = useTheme();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [timeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.ABSOLUTE
  );
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );

  const enhancedCrumbs = useMemo(
    () => getEnhancedBreadcrumbs(event, theme),
    [event, theme]
  );

  const {filterOptions, applyFilters} = useBreadcrumbFilters(enhancedCrumbs);

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? enhancedCrumbs : [...enhancedCrumbs].reverse();
    const filteredCrumbs = applyFilters(sortedCrumbs, filters);
    const searchedCrumbs = applyBreadcrumbSearch(filteredCrumbs, search);
    return searchedCrumbs;
  }, [enhancedCrumbs, sort, filters, search, applyFilters]);

  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? displayCrumbs?.at(0)?.breadcrumb?.timestamp
        : undefined,
    [displayCrumbs, timeDisplay]
  );

  if (enhancedCrumbs.length === 0) {
    return null;
  }

  const actions = (
    <ActionsWrapper>
      <SearchWrapper>
        <InputGroup>
          <SearchInput
            size="xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search')}
            aria-label={t('Search Breadcrumbs')}
          />
          <InputGroup.TrailingItems disablePointerEvents>
            <IconSearch size="xs" />
          </InputGroup.TrailingItems>
        </InputGroup>
      </SearchWrapper>
      <CompactSelect
        size="xs"
        multiple
        clearable
        position="bottom-end"
        menuTitle={t('Filter by')}
        value={filters}
        onChange={options => setFilters(options.map(({value}) => value))}
        options={filterOptions}
        maxMenuHeight={400}
        trigger={props => (
          <SelectTrigger.Button
            borderless
            showChevron={false}
            icon={<IconFilter />}
            aria-label={t('Filter Breadcrumbs')}
            title={t('Filter')}
            {...props}
          >
            {filters.length > 0 ? filters.length : ''}
          </SelectTrigger.Button>
        )}
      />
      <CompactSelect
        size="xs"
        position="bottom-end"
        trigger={props => (
          <SelectTrigger.IconButton
            borderless
            icon={<IconSort />}
            aria-label={t('Sort Breadcrumbs')}
            title={t('Sort')}
            {...props}
          />
        )}
        onChange={selectedOption => setSort(selectedOption.value)}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
    </ActionsWrapper>
  );

  return (
    <BreadcrumbsContainer>
      <InterimSection
        title={t('Breadcrumbs')}
        type="breadcrumbs"
        actions={actions}
        disableCollapsePersistence
      >
        <ScrollContainer ref={setContainer}>
          {displayCrumbs.length === 0 ? (
            <EmptyMessage>
              {t('No breadcrumbs match your search or filters.')}
            </EmptyMessage>
          ) : (
            <BreadcrumbsTimeline
              breadcrumbs={displayCrumbs}
              startTimeString={startTimeString}
              containerElement={container}
            />
          )}
        </ScrollContainer>
      </InterimSection>
    </BreadcrumbsContainer>
  );
}

const BreadcrumbsContainer = styled('div')`
  container-type: inline-size;
`;

const ActionsWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;

  @container (max-width: 400px) {
    display: none;
  }
`;

const SearchWrapper = styled('div')`
  @container (max-width: 500px) {
    display: none;
  }
`;

const SearchInput = styled(InputGroup.Input)`
  width: 180px;
`;

const ScrollContainer = styled('div')`
  max-height: ${MAX_BREADCRUMBS_HEIGHT}px;
  overflow-y: auto;
  padding-right: ${p => p.theme.space.md};
`;

const EmptyMessage = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  padding: ${p => p.theme.space.xl};
  text-align: center;
`;
