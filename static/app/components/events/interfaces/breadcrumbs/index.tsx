import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventDataSection from 'sentry/components/events/eventDataSection';
import EventReplay from 'sentry/components/events/eventReplay';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbLevelType, Crumb, RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryType, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import SearchBarAction from '../searchBarAction';

import Level from './breadcrumb/level';
import Type from './breadcrumb/type';
import Breadcrumbs from './breadcrumbs';
import {getVirtualCrumb, transformCrumbs} from './utils';

type FilterOptions = NonNullable<
  React.ComponentProps<typeof SearchBarAction>['filterOptions']
>;

type FilterOptionWithLevels = FilterOptions[0] & {levels?: BreadcrumbLevelType[]};

type Props = Pick<React.ComponentProps<typeof Breadcrumbs>, 'route' | 'router'> & {
  data: {
    values: Array<RawCrumb>;
  };
  event: Event;
  organization: Organization;
  projectSlug: string;
  isShare?: boolean;
};

type State = {
  breadcrumbs: Crumb[];
  displayRelativeTime: boolean;
  filterOptions: FilterOptions;
  filterSelections: FilterOptions;
  filteredByFilter: Crumb[];
  filteredBySearch: Crumb[];
  searchTerm: string;
  relativeTime?: string;
};
function BreadcrumbsContainer({
  data,
  event,
  organization,
  projectSlug,
  isShare,
  route,
  router,
}: Props) {
  const [state, setState] = useState<State>({
    searchTerm: '',
    breadcrumbs: [],
    filteredByFilter: [],
    filteredBySearch: [],
    filterOptions: [],
    filterSelections: [],
    displayRelativeTime: false,
  });

  const {
    filterOptions,
    breadcrumbs,
    searchTerm,
    filteredBySearch,
    displayRelativeTime,
    relativeTime,
    filteredByFilter,
  } = state;

  useEffect(() => {
    loadBreadcrumbs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadBreadcrumbs() {
    let crumbs = data.values;

    // Add the (virtual) breadcrumb based on the error or message event if possible.
    const virtualCrumb = getVirtualCrumb(event);

    if (virtualCrumb) {
      crumbs = [...crumbs, virtualCrumb];
    }

    const transformedCrumbs = transformCrumbs(crumbs);

    setState({
      ...state,
      relativeTime: transformedCrumbs[transformedCrumbs.length - 1]?.timestamp,
      breadcrumbs: transformedCrumbs,
      filteredByFilter: transformedCrumbs,
      filteredBySearch: transformedCrumbs,
      filterOptions: getFilterOptions(transformedCrumbs),
    });
  }

  function getFilterOptions(crumbs: ReturnType<typeof transformCrumbs>) {
    const typeOptions = getFilterTypes(crumbs);
    const levels = getFilterLevels(typeOptions);

    const options: FilterOptions = [];

    if (typeOptions.length) {
      options.push({
        value: 'types',
        label: t('Types'),
        options: typeOptions.map(typeOption => omit(typeOption, 'levels')),
      });
    }

    if (levels.length) {
      options.push({
        value: 'levels',
        label: t('Levels'),
        options: levels,
      });
    }

    return options;
  }

  function getFilterTypes(crumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: FilterOptionWithLevels[] = [];

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

  function getFilterLevels(types: FilterOptionWithLevels[]) {
    const filterLevels: FilterOptions = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType].levels) {
        const level = types[indexType].levels?.[indexLevel];

        if (filterLevels.some(f => f.value === `level-${level}`)) {
          continue;
        }

        filterLevels.push({
          value: `level-${level}`,
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

  function filterBySearch(newSearchTerm: string, crumbs: Crumb[]) {
    if (!newSearchTerm.trim()) {
      return crumbs;
    }

    // Slightly hacky, but it works
    // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop
    const searchFor = JSON.stringify(newSearchTerm)
      // it replaces double backslash generate by JSON.stringify with single backslash
      .replace(/((^")|("$))/g, '')
      .toLocaleLowerCase();

    return crumbs.filter(obj =>
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

  function getFilteredCrumbsByFilter(selectedFilterOptions: FilterOptions) {
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

  function handleSearch(value: string) {
    setState({
      ...state,
      searchTerm: value,
      filteredBySearch: filterBySearch(value, filteredByFilter),
    });
  }

  function handleFilter(newfilterOptions: FilterOptions) {
    const newfilteredByFilter = getFilteredCrumbsByFilter(newfilterOptions);
    setState({
      ...state,
      filterSelections: newfilterOptions,
      filteredByFilter: newfilteredByFilter,
      filteredBySearch: filterBySearch(searchTerm, newfilteredByFilter),
    });
  }

  function handleSwitchTimeFormat() {
    setState({
      ...state,
      displayRelativeTime: !displayRelativeTime,
    });
  }

  function handleResetFilter() {
    setState({
      ...state,
      filterSelections: [],
      filteredByFilter: breadcrumbs,
      filteredBySearch: filterBySearch(searchTerm, breadcrumbs),
    });
  }

  function handleResetSearchBar() {
    setState({
      ...state,
      searchTerm: '',
      filteredBySearch: breadcrumbs,
    });
  }

  function getEmptyMessage() {
    if (filteredBySearch.length) {
      return {};
    }

    if (searchTerm && !filteredBySearch.length) {
      const hasActiveFilter = state.filterSelections.length > 0;

      return {
        emptyMessage: t('Sorry, no breadcrumbs match your search query'),
        emptyAction: hasActiveFilter ? (
          <Button onClick={handleResetFilter} priority="primary">
            {t('Reset filter')}
          </Button>
        ) : (
          <Button onClick={handleResetSearchBar} priority="primary">
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
  const showReplay =
    !isShare && Boolean(replayId) && organization.features.includes('session-replay-ui');

  const searchBar = (
    <StyledSearchBarAction
      placeholder={t('Search breadcrumbs')}
      onChange={handleSearch}
      query={searchTerm}
      filterOptions={filterOptions}
      filterSelections={state.filterSelections}
      onFilterChange={handleFilter}
      isFullWidth={showReplay}
    />
  );

  return (
    <EventDataSection
      type={EntryType.BREADCRUMBS}
      title={<h3>{t('Breadcrumbs')}</h3>}
      actions={!showReplay ? searchBar : null}
      wrapTitle={false}
      isCentered
    >
      {showReplay ? (
        <Fragment>
          <EventReplay
            replayId={replayId!}
            projectSlug={projectSlug}
            orgSlug={organization.slug}
            event={event}
          />
          {searchBar}
        </Fragment>
      ) : null}
      <ErrorBoundary>
        <GuideAnchor target="breadcrumbs" position="bottom">
          <Breadcrumbs
            router={router}
            route={route}
            emptyMessage={getEmptyMessage()}
            breadcrumbs={filteredBySearch}
            event={event}
            organization={organization}
            onSwitchTimeFormat={handleSwitchTimeFormat}
            displayRelativeTime={displayRelativeTime}
            searchTerm={searchTerm}
            relativeTime={relativeTime!} // relativeTime has to be always available, as the last item timestamp is the event created time
          />
        </GuideAnchor>
      </ErrorBoundary>
    </EventDataSection>
  );
}

export default BreadcrumbsContainer;

const StyledSearchBarAction = styled(SearchBarAction)<{isFullWidth?: boolean}>`
  z-index: 2;
  ${p => (p.isFullWidth ? 'width: 100% !important' : '')};
  margin-bottom: ${p => (p.isFullWidth ? space(1) : 0)};
`;

const LevelWrap = styled('span')`
  height: ${p => p.theme.text.lineHeightBody}em;
  display: flex;
  align-items: center;
`;
