import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {Button} from 'sentry/components/button';
import type {SelectOption, SelectSection} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import type {BreadcrumbWithMeta} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {BreadcrumbLevelType, RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import SearchBarAction from '../searchBarAction';

import Level from './breadcrumb/level';
import Type from './breadcrumb/type';
import Breadcrumbs from './breadcrumbs';
import {getVirtualCrumb, transformCrumbs} from './utils';

type SelectOptionWithLevels = SelectOption<string> & {levels?: BreadcrumbLevelType[]};

type Props = {
  data: {
    values: RawCrumb[];
  };
  event: Event;
  organization: Organization;
  hideTitle?: boolean;
};

export enum BreadcrumbSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
}

export const BREADCRUMB_SORT_LOCALSTORAGE_KEY = 'event-breadcrumb-sort';

export const BREADCRUMB_SORT_OPTIONS = [
  {label: t('Newest'), value: BreadcrumbSort.NEWEST},
  {label: t('Oldest'), value: BreadcrumbSort.OLDEST},
];

type BreadcrumbListType = BreadcrumbWithMeta | EnhancedCrumb;

export function applyBreadcrumbSearch<T extends BreadcrumbListType>(
  breadcrumbs: T[],
  newSearchTerm: string
): T[] {
  if (!newSearchTerm.trim()) {
    return breadcrumbs;
  }

  // Slightly hacky, but it works
  // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop
  const searchFor = JSON.stringify(newSearchTerm)
    // it replaces double backslash generate by JSON.stringify with single backslash
    .replace(/((^")|("$))/g, '')
    .toLocaleLowerCase();

  return breadcrumbs.filter(({breadcrumb}) =>
    Object.keys(
      pick(breadcrumb, ['type', 'category', 'message', 'level', 'timestamp', 'data'])
    ).some(key => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const info = breadcrumb[key];

      if (!defined(info) || !String(info).trim()) {
        return false;
      }

      return JSON.stringify(info)
        .replace(/((^")|("$))/g, '')
        .toLocaleLowerCase()
        .trim()
        .includes(searchFor);
    })
  );
}

function BreadcrumbsContainer({data, event, organization, hideTitle = false}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSelections, setFilterSelections] = useState<SelectOption<string>[]>([]);
  const [displayRelativeTime, setDisplayRelativeTime] = useState(false);
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );

  const entryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );

  const initialBreadcrumbs = useMemo(() => {
    let crumbs = data.values;

    // Add the (virtual) breadcrumb based on the error or message event if possible.
    const virtualCrumb = getVirtualCrumb(event);

    if (virtualCrumb) {
      crumbs = [...crumbs, virtualCrumb];
    }

    return transformCrumbs(crumbs);
  }, [data, event]);

  const relativeTime = useMemo(() => {
    return initialBreadcrumbs[initialBreadcrumbs.length - 1]?.timestamp ?? '';
  }, [initialBreadcrumbs]);

  const filterOptions = useMemo(() => {
    const typeOptions = getFilterTypes(initialBreadcrumbs);
    const levels = getFilterLevels(typeOptions);

    const options: SelectSection<string>[] = [];

    if (typeOptions.length) {
      options.push({
        key: 'types',
        label: t('Types'),
        options: typeOptions.map(typeOption => omit(typeOption, 'levels')),
      });
    }

    if (levels.length) {
      options.push({
        key: 'levels',
        label: t('Levels'),
        options: levels,
      });
    }

    return options;
  }, [initialBreadcrumbs]);

  function getFilterTypes(crumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: SelectOptionWithLevels[] = [];

    for (const index in crumbs) {
      const breadcrumb = crumbs[index];
      const foundFilterType = filterTypes.findIndex(
        f => f.value === `type-${breadcrumb!.type}`
      );

      if (foundFilterType === -1) {
        filterTypes.push({
          value: `type-${breadcrumb!.type}`,
          leadingItems: <Type type={breadcrumb!.type} color={breadcrumb!.color} />,
          label: breadcrumb!.description,
          levels: breadcrumb!.level ? [breadcrumb!.level] : [],
        });
        continue;
      }

      if (
        breadcrumb?.level &&
        !filterTypes[foundFilterType]!.levels?.includes(breadcrumb.level)
      ) {
        filterTypes[foundFilterType]!.levels?.push(breadcrumb!.level);
      }
    }

    return filterTypes;
  }

  function getFilterLevels(types: SelectOptionWithLevels[]) {
    const filterLevels: SelectOption<string>[] = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType]!.levels) {
        // @ts-ignore TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        const level = types[indexType]!.levels?.[indexLevel];

        if (filterLevels.some(f => f.value === `level-${level}`)) {
          continue;
        }

        filterLevels.push({
          value: `level-${level}`,
          textValue: level,
          label: (
            <LevelWrap>
              <Level level={level} />
            </LevelWrap>
          ),
        });
      }
    }

    return filterLevels;
  }

  function applySelectedFilters(
    breadcrumbs: BreadcrumbWithMeta[],
    selectedFilterOptions: SelectOption<string>[]
  ) {
    const checkedTypeOptions = new Set(
      selectedFilterOptions
        .filter(option => option.value.startsWith('type-'))
        .map(option => option.value.split('-')[1])
    );

    const checkedLevelOptions = new Set(
      selectedFilterOptions
        .filter(option => option.value.startsWith('level-'))
        .map(option => option.value.split('-')[1])
    );

    if (!![...checkedTypeOptions].length && !![...checkedLevelOptions].length) {
      return breadcrumbs.filter(
        ({breadcrumb}) =>
          checkedTypeOptions.has(breadcrumb.type) &&
          checkedLevelOptions.has(breadcrumb.level)
      );
    }

    if ([...checkedTypeOptions].length) {
      return breadcrumbs.filter(({breadcrumb}) =>
        checkedTypeOptions.has(breadcrumb.type)
      );
    }

    if ([...checkedLevelOptions].length) {
      return breadcrumbs.filter(({breadcrumb}) =>
        checkedLevelOptions.has(breadcrumb.level)
      );
    }

    return breadcrumbs;
  }

  const displayedBreadcrumbs = useMemo(() => {
    const breadcrumbsWithMeta = initialBreadcrumbs.map((breadcrumb, index) => ({
      breadcrumb,
      meta: event._meta?.entries?.[entryIndex]?.data?.values?.[index],
    }));
    const filteredBreadcrumbs = applyBreadcrumbSearch(
      applySelectedFilters(breadcrumbsWithMeta, filterSelections),
      searchTerm
    );

    // Breadcrumbs come back from API sorted oldest -> newest.
    // Need to `reverse()` instead of sort by timestamp because crumbs with
    // exact same timestamp will appear out of order.
    return sort === BreadcrumbSort.NEWEST
      ? [...filteredBreadcrumbs].reverse()
      : filteredBreadcrumbs;
  }, [
    entryIndex,
    event._meta?.entries,
    filterSelections,
    initialBreadcrumbs,
    searchTerm,
    sort,
  ]);

  function getEmptyMessage() {
    if (displayedBreadcrumbs.length) {
      return {};
    }

    if (searchTerm && !displayedBreadcrumbs.length) {
      const hasActiveFilter = filterSelections.length > 0;

      return {
        emptyMessage: t('Sorry, no breadcrumbs match your search query'),
        emptyAction: hasActiveFilter ? (
          <Button onClick={() => setFilterSelections([])} priority="primary">
            {t('Reset filter')}
          </Button>
        ) : (
          <Button onClick={() => setSearchTerm('')} priority="primary">
            {t('Clear search bar')}
          </Button>
        ),
      };
    }

    return {
      emptyMessage: t('There are no breadcrumbs to be displayed'),
    };
  }

  const actions = (
    <SearchAndSortWrapper>
      <SearchBarAction
        placeholder={t('Search breadcrumbs')}
        onChange={setSearchTerm}
        query={searchTerm}
        filterOptions={filterOptions}
        filterSelections={filterSelections}
        onFilterChange={setFilterSelections}
      />
      <CompactSelect
        triggerProps={{
          icon: <IconSort />,
          size: 'sm',
        }}
        onChange={selectedOption => {
          setSort(selectedOption.value);
        }}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
    </SearchAndSortWrapper>
  );

  return (
    <InterimSection
      showPermalink={!hideTitle}
      type={SectionKey.BREADCRUMBS}
      title={hideTitle ? '' : t('Breadcrumbs')}
      actions={actions}
    >
      <ErrorBoundary>
        <Breadcrumbs
          emptyMessage={getEmptyMessage()}
          breadcrumbs={displayedBreadcrumbs}
          event={event}
          organization={organization}
          onSwitchTimeFormat={() => setDisplayRelativeTime(old => !old)}
          displayRelativeTime={displayRelativeTime}
          searchTerm={searchTerm}
          relativeTime={relativeTime}
        />
      </ErrorBoundary>
    </InterimSection>
  );
}

export {BreadcrumbsContainer as Breadcrumbs};

export const SearchAndSortWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr;
  }

  @container breadcrumbs (width < 640px) {
    display: none;
  }
`;

const LevelWrap = styled('span')`
  height: ${p => p.theme.text.lineHeightBody}em;
  display: flex;
  align-items: center;
`;
