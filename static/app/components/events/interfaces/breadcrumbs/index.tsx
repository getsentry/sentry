import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {
  CompactSelect,
  SelectOption,
  SelectSection,
} from 'sentry/components/compactSelect';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import EventReplay from 'sentry/components/events/eventReplay';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbLevelType, Crumb, RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryType, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import SearchBarAction from '../searchBarAction';

import Level from './breadcrumb/level';
import Type from './breadcrumb/type';
import Breadcrumbs from './breadcrumbs';
import {getVirtualCrumb, transformCrumbs} from './utils';

type SelectOptionWithLevels = SelectOption<string> & {levels?: BreadcrumbLevelType[]};

type Props = {
  data: {
    values: Array<RawCrumb>;
  };
  event: Event;
  organization: Organization;
  projectSlug: string;
  isShare?: boolean;
};

enum BreadcrumbSort {
  Newest = 'newest',
  Oldest = 'oldest',
}

const EVENT_BREADCRUMB_SORT_LOCALSTORAGE_KEY = 'event-breadcrumb-sort';

const sortOptions = [
  {label: t('Newest'), value: BreadcrumbSort.Newest},
  {label: t('Oldest'), value: BreadcrumbSort.Oldest},
];

function BreadcrumbsContainer({data, event, organization, projectSlug, isShare}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSelections, setFilterSelections] = useState<SelectOption<string>[]>([]);
  const [displayRelativeTime, setDisplayRelativeTime] = useState(false);
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    EVENT_BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.Newest
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
        f => f.value === `type-${breadcrumb.type}`
      );

      if (foundFilterType === -1) {
        filterTypes.push({
          value: `type-${breadcrumb.type}`,
          leadingItems: <Type type={breadcrumb.type} color={breadcrumb.color} />,
          label: breadcrumb.description,
          levels: breadcrumb?.level ? [breadcrumb.level] : [],
        });
        continue;
      }

      if (
        breadcrumb?.level &&
        !filterTypes[foundFilterType].levels?.includes(breadcrumb.level)
      ) {
        filterTypes[foundFilterType].levels?.push(breadcrumb.level);
      }
    }

    return filterTypes;
  }

  function getFilterLevels(types: SelectOptionWithLevels[]) {
    const filterLevels: SelectOption<string>[] = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType].levels) {
        const level = types[indexType].levels?.[indexLevel];

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

  function applySearchTerm(breadcrumbs: Crumb[], newSearchTerm: string) {
    if (!newSearchTerm.trim()) {
      return breadcrumbs;
    }

    // Slightly hacky, but it works
    // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop
    const searchFor = JSON.stringify(newSearchTerm)
      // it replaces double backslash generate by JSON.stringify with single backslash
      .replace(/((^")|("$))/g, '')
      .toLocaleLowerCase();

    return breadcrumbs.filter(obj =>
      Object.keys(
        pick(obj, ['type', 'category', 'message', 'level', 'timestamp', 'data'])
      ).some(key => {
        const info = obj[key];

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

  function applySelectedFilters(
    breadcrumbs: Crumb[],
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
        filteredCrumb =>
          checkedTypeOptions.has(filteredCrumb.type) &&
          checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    if ([...checkedTypeOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedTypeOptions.has(filteredCrumb.type)
      );
    }

    if ([...checkedLevelOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    return breadcrumbs;
  }

  const displayedBreadcrumbs = useMemo(() => {
    const filteredBreadcrumbs = applySearchTerm(
      applySelectedFilters(initialBreadcrumbs, filterSelections),
      searchTerm
    );

    // Breadcrumbs come back from API sorted oldest -> newest.
    // Need to `reverse()` instead of sort by timestamp because crumbs with
    // exact same timestamp will appear out of order.
    return sort === BreadcrumbSort.Newest
      ? [...filteredBreadcrumbs].reverse()
      : filteredBreadcrumbs;
  }, [filterSelections, initialBreadcrumbs, searchTerm, sort]);

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

  const replayId = event?.tags?.find(({key}) => key === 'replayId')?.value;
  const showReplay = !isShare && organization.features.includes('session-replay');

  const actions = (
    <SearchAndSortWrapper isFullWidth={showReplay}>
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
        options={sortOptions}
      />
    </SearchAndSortWrapper>
  );

  return (
    <EventDataSection
      type={EntryType.BREADCRUMBS}
      title={t('Breadcrumbs')}
      actions={!showReplay ? actions : null}
    >
      {showReplay ? (
        <Fragment>
          <EventReplay
            organization={organization}
            replayId={replayId}
            projectSlug={projectSlug}
            event={event}
          />
          {actions}
        </Fragment>
      ) : null}
      <ErrorBoundary>
        <GuideAnchor target="breadcrumbs" position="bottom">
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
        </GuideAnchor>
      </ErrorBoundary>
    </EventDataSection>
  );
}

export {BreadcrumbsContainer as Breadcrumbs};

const SearchAndSortWrapper = styled('div')<{isFullWidth?: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr;
  }

  margin-bottom: ${p => (p.isFullWidth ? space(1) : 0)};
`;

const LevelWrap = styled('span')`
  height: ${p => p.theme.text.lineHeightBody}em;
  display: flex;
  align-items: center;
`;
