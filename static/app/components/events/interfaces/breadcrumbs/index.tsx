import * as React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import {IconWarning} from 'app/icons/iconWarning';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  Breadcrumb,
  BreadcrumbLevelType,
  BreadcrumbsWithDetails,
  BreadcrumbType,
} from 'app/types/breadcrumbs';
import {EntryType, Event} from 'app/types/event';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import SearchBarAction from '../searchBarAction';
import SearchBarActionFilter from '../searchBarAction/searchBarActionFilter';

import Icon from './icon';
import Level from './level';
import List from './list';
import {aroundContentStyle} from './styles';
import {transformCrumbs} from './utils';

type FilterOptions = React.ComponentProps<typeof SearchBarActionFilter>['options'];
type FilterTypes = {
  id: BreadcrumbType;
  symbol: React.ReactElement;
  isChecked: boolean;
  description: string;
  levels: BreadcrumbLevelType[];
};

type Props = {
  event: Event;
  organization: Organization;
  type: string;
  data: {
    values: Array<Breadcrumb>;
  };
};

type State = {
  searchTerm: string;
  breadcrumbs: BreadcrumbsWithDetails;
  filteredByFilter: BreadcrumbsWithDetails;
  filteredBySearch: BreadcrumbsWithDetails;
  filterOptions: FilterOptions;
  displayRelativeTime: boolean;
  relativeTime?: string;
};

class Breadcrumbs extends React.Component<Props, State> {
  state: State = {
    searchTerm: '',
    breadcrumbs: [],
    filteredByFilter: [],
    filteredBySearch: [],
    filterOptions: {},
    displayRelativeTime: false,
  };

  componentDidMount() {
    this.loadBreadcrumbs();
  }

  loadBreadcrumbs() {
    const {data} = this.props;
    let breadcrumbs = data.values;

    // Add the (virtual) breadcrumb based on the error or message event if possible.
    const virtualCrumb = this.getVirtualCrumb();
    if (virtualCrumb) {
      breadcrumbs = [...breadcrumbs, virtualCrumb];
    }

    const transformedCrumbs = transformCrumbs(breadcrumbs);
    const filterOptions = this.getFilterOptions(transformedCrumbs);

    this.setState({
      relativeTime: transformedCrumbs[transformedCrumbs.length - 1]?.timestamp,
      breadcrumbs: transformedCrumbs,
      filteredByFilter: transformedCrumbs,
      filteredBySearch: transformedCrumbs,
      filterOptions,
    });
  }

  getFilterOptions(breadcrumbs: ReturnType<typeof transformCrumbs>) {
    const types = this.getFilterTypes(breadcrumbs);
    const levels = this.getFilterLevels(types);

    const options = {};

    if (!!types.length) {
      options[t('Types')] = types.map(type => omit(type, 'levels'));
    }

    if (!!levels.length) {
      options[t('Levels')] = levels;
    }

    return options;
  }

  getFilterTypes(breadcrumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: FilterTypes[] = [];

    for (const index in breadcrumbs) {
      const breadcrumb = breadcrumbs[index];
      const foundFilterType = filterTypes.findIndex(f => f.id === breadcrumb.type);

      if (foundFilterType === -1) {
        filterTypes.push({
          id: breadcrumb.type,
          symbol: <Icon {...omit(breadcrumb, 'description')} size="xs" />,
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

  getFilterLevels(types: FilterTypes[]) {
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

  moduleToCategory(module?: string | null) {
    if (!module) {
      return undefined;
    }
    const match = module.match(/^.*\/(.*?)(:\d+)/);
    if (!match) {
      return module.split(/./)[0];
    }
    return match[1];
  }

  getVirtualCrumb(): Breadcrumb | undefined {
    const {event} = this.props;

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
        category: this.moduleToCategory(mdl) || 'exception',
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

  filterBySearch(searchTerm: string, breadcrumbs: BreadcrumbsWithDetails) {
    if (!searchTerm.trim()) {
      return breadcrumbs;
    }

    // Slightly hacky, but it works
    // the string is being `stringfy`d here in order to match exactly the same `stringfy`d string of the loop
    const searchFor = JSON.stringify(searchTerm)
      // it replaces double backslash generate by JSON.stringfy with single backslash
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

  getFilteredCrumbsByFilter(filterOptions: FilterOptions) {
    const checkedTypeOptions = new Set(
      Object.values(filterOptions)[0]
        .filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    const checkedLevelOptions = new Set(
      Object.values(filterOptions)[1]
        .filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    const {breadcrumbs} = this.state;

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

  handleSearch = (value: string) => {
    this.setState(prevState => ({
      searchTerm: value,
      filteredBySearch: this.filterBySearch(value, prevState.filteredByFilter),
    }));
  };

  handleFilter = (filterOptions: FilterOptions) => {
    const filteredByFilter = this.getFilteredCrumbsByFilter(filterOptions);

    this.setState(prevState => ({
      filterOptions,
      filteredByFilter,
      filteredBySearch: this.filterBySearch(prevState.searchTerm, filteredByFilter),
    }));
  };

  handleSwitchTimeFormat = () => {
    this.setState(prevState => ({
      displayRelativeTime: !prevState.displayRelativeTime,
    }));
  };

  handleCleanSearch = () => {
    this.setState({searchTerm: ''});
  };

  handleResetFilter = () => {
    this.setState(({breadcrumbs, filterOptions, searchTerm}) => ({
      filteredByFilter: breadcrumbs,
      filterOptions: Object.keys(filterOptions).reduce((accumulator, currentValue) => {
        accumulator[currentValue] = filterOptions[currentValue].map(filterOption => ({
          ...filterOption,
          isChecked: false,
        }));
        return accumulator;
      }, {}),
      filteredBySearch: this.filterBySearch(searchTerm, breadcrumbs),
    }));
  };

  handleResetSearchBar = () => {
    this.setState(prevState => ({
      searchTerm: '',
      filteredBySearch: prevState.breadcrumbs,
    }));
  };

  getEmptyMessage() {
    const {searchTerm, filteredBySearch, filterOptions} = this.state;

    if (searchTerm && !filteredBySearch.length) {
      const hasActiveFilter = Object.values(filterOptions)
        .flatMap(filterOption => filterOption)
        .find(filterOption => filterOption.isChecked);

      return (
        <StyledEmptyMessage
          icon={<IconWarning size="xl" />}
          action={
            hasActiveFilter ? (
              <Button onClick={this.handleResetFilter} priority="primary">
                {t('Reset filter')}
              </Button>
            ) : (
              <Button onClick={this.handleResetSearchBar} priority="primary">
                {t('Clear search bar')}
              </Button>
            )
          }
        >
          {t('Sorry, no breadcrumbs match your search query')}
        </StyledEmptyMessage>
      );
    }

    return (
      <StyledEmptyMessage icon={<IconWarning size="xl" />}>
        {t('There are no breadcrumbs to be displayed')}
      </StyledEmptyMessage>
    );
  }

  render() {
    const {type, event, organization} = this.props;
    const {
      filterOptions,
      searchTerm,
      filteredBySearch,
      displayRelativeTime,
      relativeTime,
    } = this.state;

    return (
      <StyledEventDataSection
        type={type}
        title={
          <GuideAnchor target="breadcrumbs" position="right">
            <h3>{t('Breadcrumbs')}</h3>
          </GuideAnchor>
        }
        actions={
          <StyledSearchBarAction
            placeholder={t('Search breadcrumbs')}
            onChange={this.handleSearch}
            query={searchTerm}
            filter={
              <SearchBarActionFilter
                onChange={this.handleFilter}
                options={filterOptions}
              />
            }
          />
        }
        wrapTitle={false}
        isCentered
      >
        {!!filteredBySearch.length ? (
          <ErrorBoundary>
            <List
              breadcrumbs={filteredBySearch}
              event={event}
              orgId={organization.slug}
              onSwitchTimeFormat={this.handleSwitchTimeFormat}
              displayRelativeTime={displayRelativeTime}
              searchTerm={searchTerm}
              relativeTime={relativeTime!} // relativeTime has to be always available, as the last item timestamp is the event created time
            />
          </ErrorBoundary>
        ) : (
          this.getEmptyMessage()
        )}
      </StyledEventDataSection>
    );
  }
}

export default Breadcrumbs;

const StyledEventDataSection = styled(EventDataSection)`
  margin-bottom: ${space(3)};
`;

const StyledEmptyMessage = styled(EmptyMessage)`
  ${aroundContentStyle};
`;

const StyledSearchBarAction = styled(SearchBarAction)`
  z-index: 2;
`;
