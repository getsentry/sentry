import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ClippedBox from 'sentry/components/clippedBox';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  getBreadcrumbFilters,
} from 'sentry/components/events/breadcrumbs/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {getVirtualCrumb} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import Input from 'sentry/components/input';
import {IconClock, IconFilter, IconSort} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type Event} from 'sentry/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface BreadcrumbsDataSectionProps {
  event: Event;
}

export default function BreadcrumbsDataSection({event}: BreadcrumbsDataSectionProps) {
  const [search, setSearch] = useState('');
  const [filterSet, setFilterSet] = useState(new Set<string>());
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.RELATIVE
  );

  const breadcrumbEntryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );
  if (!breadcrumbEntryIndex) {
    return null;
  }
  const breadcrumbs = event.entries[breadcrumbEntryIndex]?.data?.values ?? [];
  if (breadcrumbs.length <= 0) {
    return null;
  }

  const meta = event._meta?.entries?.[breadcrumbEntryIndex]?.data?.values;

  // The virtual crumb is a representation of this event, displayed alongside
  // the rest of the breadcrumbs for more additional context.
  const virtualCrumb = getVirtualCrumb(event);
  let virtualCrumbIndex: number | undefined;
  const allCrumbs = [...breadcrumbs];
  if (virtualCrumb) {
    virtualCrumbIndex = allCrumbs.length;
    allCrumbs.push(virtualCrumb);
  }

  const filterOptions = getBreadcrumbFilters(allCrumbs);
  const filteredCrumbs = allCrumbs.filter(bc =>
    filterSet.size === 0 ? true : filterSet.has(bc.type)
  );

  const searchedCrumbs = applyBreadcrumbSearch(search, filteredCrumbs);

  const hasFilters = filterSet.size > 0 || search.length > 0;

  const actions = (
    <ButtonBar gap={1}>
      <Input
        size="xs"
        placeholder={t('Search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <CompactSelect
        size="xs"
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilterSet(new Set(newFilters));
        }}
        multiple
        options={filterOptions}
        maxMenuHeight={400}
        trigger={(props, isOpen) => (
          <DropdownButton
            isOpen={isOpen}
            size="xs"
            icon={<IconFilter size="xs" />}
            {...props}
          >
            {filterSet.size
              ? tn('%s Active Filter', '%s Active Filters', filterSet.size)
              : t('Filter')}
          </DropdownButton>
        )}
      />
      <CompactSelect
        size="xs"
        triggerProps={{
          icon: <IconSort size="xs" />,
        }}
        onChange={selectedOption => {
          setSort(selectedOption.value);
        }}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
      <CompactSelect
        size="xs"
        triggerProps={{
          icon: <IconClock size="xs" />,
        }}
        onChange={selectedOption => {
          setTimeDisplay(selectedOption.value);
        }}
        value={timeDisplay}
        options={BREADCRUMB_TIME_DISPLAY_OPTIONS}
      />
    </ButtonBar>
  );

  return (
    <EventDataSection
      key="breadcrumbs"
      type="breadcrmbs"
      title={t('Breadcrumbs')}
      actions={actions}
      data-test-id="breadcrumbs-data-section"
    >
      <ErrorBoundary mini message={t('There was an error loading the event breadcrumbs')}>
        {searchedCrumbs.length ? (
          <ClippedBox clipHeight={250}>
            <BreadcrumbsTimeline
              breadcrumbs={searchedCrumbs}
              virtualCrumbIndex={virtualCrumbIndex}
              meta={meta}
              sort={sort}
              timeDisplay={timeDisplay}
            />
          </ClippedBox>
        ) : (
          <EmptyBreadcrumbsMessage>
            {t('No breadcrumbs found. ')}
            {hasFilters && (
              <ClearFiltersButton
                size="xs"
                onClick={() => {
                  setFilterSet(new Set());
                  setSearch('');
                }}
              >
                {t('Clear filters')}
              </ClearFiltersButton>
            )}
          </EmptyBreadcrumbsMessage>
        )}
      </ErrorBoundary>
    </EventDataSection>
  );
}

const EmptyBreadcrumbsMessage = styled('div')`
  border: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  border-radius: 4px;
  padding: ${space(3)} ${space(1)};
`;

const ClearFiltersButton = styled(Button)`
  margin-top: ${space(1)};
`;
