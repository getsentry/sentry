import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {
  BreadcrumbLevelType,
  BreadcrumbType,
  Crumb,
  RawCrumb,
} from 'sentry/types/breadcrumbs';
import {EntryType, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import SearchBarAction from '../searchBarAction';
import SearchBarActionFilter from '../searchBarAction/searchBarActionFilter';

import Level from './breadcrumb/level';
import Type from './breadcrumb/type';
import Breadcrumbs from './breadcrumbs';
import {transformCrumbs} from './utils';

type FilterOptions = React.ComponentProps<typeof SearchBarActionFilter>['options'];

type FilterTypes = {
  description: string;
  id: BreadcrumbType;
  isChecked: boolean;
  levels: BreadcrumbLevelType[];
  symbol: React.ReactElement;
};

type Props = Pick<React.ComponentProps<typeof Breadcrumbs>, 'route' | 'router'> & {
  data: {
    values: Array<RawCrumb>;
  };
  event: Event;
  organization: Organization;
  type: string;
};

type State = {
  breadcrumbs: Crumb[];
  displayRelativeTime: boolean;
  filterOptions: FilterOptions;
  filteredByFilter: Crumb[];
  filteredBySearch: Crumb[];
  searchTerm: string;
  relativeTime?: string;
};

function BreadcrumbsContainer({
  data,
  event,
  organization,
  type: eventType,
  route,
  router,
}: Props) {
  const [state, setState] = useState<State>({
    searchTerm: '',
    breadcrumbs: [],
    filteredByFilter: [],
    filteredBySearch: [],
    filterOptions: {},
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
  }, []);

  function loadBreadcrumbs() {
    let crumbs = data.values;

    // Add the (virtual) breadcrumb based on the error or message event if possible.
    const virtualCrumb = getVirtualCrumb();

    if (virtualCrumb) {
      crumbs = [...crumbs, virtualCrumb];
    }

    const transformedCrumbs = transformCrumbs(crumbs);

    setState({
      ...state,
      relativeTime: transformedCrumbs[transformedCrumbs.length - 1].timestamp,
      breadcrumbs: transformedCrumbs,
      filteredByFilter: transformedCrumbs,
      filteredBySearch: transformedCrumbs,
      filterOptions: getFilterOptions(transformedCrumbs),
    });
  }

  function getFilterOptions(crumbs: ReturnType<typeof transformCrumbs>) {
    const typeOptions = getFilterTypes(crumbs);
    const levels = getFilterLevels(typeOptions);

    const options = {};

    if (!!typeOptions.length) {
      options[t('Types')] = typeOptions.map(typeOption => omit(typeOption, 'levels'));
    }

    if (!!levels.length) {
      options[t('Levels')] = levels;
    }

    return options;
  }

  function getFilterTypes(crumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: FilterTypes[] = [];

    for (const index in crumbs) {
      const breadcrumb = crumbs[index];
      const foundFilterType = filterTypes.findIndex(f => f.id === breadcrumb.type);

      if (foundFilterType === -1) {
        filterTypes.push({
          id: breadcrumb.type,
          symbol: <Type type={breadcrumb.type} color={breadcrumb.color} />,
          isChecked: false,
          description: breadcrumb.description,
          levels: breadcrumb?.level ? [breadcrumb.level] : [],
        });
        continue;
      }

      if (
        breadcrumb?.level &&
        !filterTypes[foundFilterType].levels.includes(breadcrumb.level)
      ) {
        filterTypes[foundFilterType].levels.push(breadcrumb.level);
      }
    }

    return filterTypes;
  }

  function getFilterLevels(types: FilterTypes[]) {
    const filterLevels: FilterOptions[0] = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType].levels) {
        const level = types[indexType].levels[indexLevel];

        if (filterLevels.some(f => f.id === level)) {
          continue;
        }

        filterLevels.push({
          id: level,
          symbol: <Level level={level} />,
          isChecked: false,
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
    // the string is being `stringfy`d here in order to match exactly the same `stringfy`d string of the loop
    const searchFor = JSON.stringify(newSearchTerm)
      // it replaces double backslash generate by JSON.stringfy with single backslash
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

  function getFilteredCrumbsByFilter(newfilterOptions: FilterOptions) {
    const checkedTypeOptions = new Set(
      Object.values(newfilterOptions)[0]
        .filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    const checkedLevelOptions = new Set(
      Object.values(newfilterOptions)[1]
        .filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    if (!![...checkedTypeOptions].length && !![...checkedLevelOptions].length) {
      return breadcrumbs.filter(
        filteredCrumb =>
          checkedTypeOptions.has(filteredCrumb.type) &&
          checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    if (!![...checkedTypeOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedTypeOptions.has(filteredCrumb.type)
      );
    }

    if (!![...checkedLevelOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    return breadcrumbs;
  }

  function moduleToCategory(module?: string | null) {
    if (!module) {
      return undefined;
    }
    const match = module.match(/^.*\/(.*?)(:\d+)/);
    if (!match) {
      return module.split(/./)[0];
    }
    return match[1];
  }

  function getVirtualCrumb(): RawCrumb | undefined {
    const exception = event.entries.find(entry => entry.type === EntryType.EXCEPTION);

    if (!exception && !event.message) {
      return undefined;
    }

    const timestamp = event.dateCreated;

    if (exception) {
      const {type, value, module: mdl} = exception.data.values[0];
      return {
        type: BreadcrumbType.ERROR,
        level: BreadcrumbLevelType.ERROR,
        category: moduleToCategory(mdl) || 'exception',
        data: {
          type,
          value,
        },
        timestamp,
      };
    }

    const levelTag = (event.tags || []).find(tag => tag.key === 'level');

    return {
      type: BreadcrumbType.INFO,
      level: (levelTag?.value as BreadcrumbLevelType) || BreadcrumbLevelType.UNDEFINED,
      category: 'message',
      message: event.message,
      timestamp,
    };
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
      filterOptions: newfilterOptions,
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
      filteredByFilter: breadcrumbs,
      filterOptions: Object.keys(filterOptions).reduce((accumulator, currentValue) => {
        accumulator[currentValue] = filterOptions[currentValue].map(filterOption => ({
          ...filterOption,
          isChecked: false,
        }));
        return accumulator;
      }, {}),
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
    if (!!filteredBySearch.length) {
      return {};
    }

    if (searchTerm && !filteredBySearch.length) {
      const hasActiveFilter = Object.values(filterOptions)
        .flatMap(filterOption => filterOption)
        .find(filterOption => filterOption.isChecked);

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

  return (
    <EventDataSection
      type={eventType}
      title={
        <GuideAnchor target="breadcrumbs" position="right">
          <h3>{t('Breadcrumbs')}</h3>
        </GuideAnchor>
      }
      actions={
        <StyledSearchBarAction
          placeholder={t('Search breadcrumbs')}
          onChange={handleSearch}
          query={searchTerm}
          filter={
            <SearchBarActionFilter onChange={handleFilter} options={filterOptions} />
          }
        />
      }
      wrapTitle={false}
      isCentered
    >
      <ErrorBoundary>
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
      </ErrorBoundary>
    </EventDataSection>
  );
}

export default BreadcrumbsContainer;

const StyledSearchBarAction = styled(SearchBarAction)`
  z-index: 2;
`;
