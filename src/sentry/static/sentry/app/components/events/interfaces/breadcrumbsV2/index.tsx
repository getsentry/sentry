import React from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import omit from 'lodash/omit';

import EventDataSection from 'app/components/events/eventDataSection';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {t} from 'app/locale';
import {Event} from 'app/types';
import space from 'app/styles/space';
import SearchBar from 'app/components/searchBar';
import Button from 'app/components/button';
import {IconWarning} from 'app/icons/iconWarning';
import {defined} from 'app/utils';

import {
  Breadcrumb,
  BreadcrumbsWithDetails,
  BreadcrumbType,
  BreadcrumbLevelType,
} from './types';
import transformCrumbs from './transformCrumbs';
import Filter from './filter';
import List from './list';
import Level from './level';
import Icon from './icon';
import {aroundContentStyle} from './styles';

const ISO_STRING_DATE_AND_TIME_DIVISION = 10;

type FilterProps = React.ComponentProps<typeof Filter>;
type FilterOptions = FilterProps['options'];

type Props = {
  event: Event;
  orgId: string | null;
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
    filterOptions: [[], []],
    displayRelativeTime: false,
  };

  componentDidMount() {
    this.loadBreadcrumbs();
  }

  loadBreadcrumbs() {
    const {data} = this.props;
    let breadcrumbs = data.values;

    // Add the error event as the final (virtual) breadcrumb
    const virtualCrumb = this.getVirtualCrumb(breadcrumbs[0]);
    if (virtualCrumb) {
      breadcrumbs = [...breadcrumbs, virtualCrumb];
    }

    const transformedCrumbs = transformCrumbs(breadcrumbs);
    const filterOptions = this.getFilterOptions(transformedCrumbs);

    this.setState({
      breadcrumbs: transformedCrumbs,
      filteredByFilter: transformedCrumbs,
      filteredBySearch: transformedCrumbs,
      filterOptions,
      relativeTime: transformedCrumbs[transformedCrumbs.length - 1]?.timestamp,
    });
  }

  getFilterOptions(breadcrumbs: ReturnType<typeof transformCrumbs>): FilterOptions {
    const types = this.getFilterTypes(breadcrumbs);
    const levels = this.getFilterLevels(types);
    return [types, levels];
  }

  getFilterTypes(breadcrumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: FilterOptions[0] = [];

    for (const index in breadcrumbs) {
      const breadcrumb = breadcrumbs[index];
      const foundFilterType = filterTypes.findIndex(f => f.type === breadcrumb.type);

      if (foundFilterType === -1) {
        filterTypes.push({
          type: breadcrumb.type,
          description: breadcrumb.description,
          symbol: <Icon {...omit(breadcrumb, 'description')} size="xs" />,
          levels: breadcrumb?.level ? [breadcrumb.level] : [],
          isChecked: false,
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

  getFilterLevels(types: FilterOptions[0]) {
    const filterLevels: FilterOptions[1] = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType].levels) {
        const level = types[indexType].levels[indexLevel];

        if (filterLevels.some(f => f.type === level)) {
          continue;
        }

        filterLevels.push({
          type: level,
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

  getVirtualCrumb(breadcrumb: Breadcrumb): Breadcrumb | undefined {
    const {event} = this.props;

    const timestamp =
      breadcrumb?.timestamp && event.dateCreated
        ? `${breadcrumb.timestamp.slice(
            0,
            ISO_STRING_DATE_AND_TIME_DIVISION
          )}${event.dateCreated.slice(ISO_STRING_DATE_AND_TIME_DIVISION)}`
        : undefined;

    const exception = event.entries.find(
      entry => entry.type === BreadcrumbType.EXCEPTION
    );

    if (!exception && !event.message) {
      return undefined;
    }

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
      type: BreadcrumbType.ERROR,
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

  filterCrumbsBy(
    type: keyof Pick<BreadcrumbsWithDetails[0], 'level' | 'type'>,
    breadcrumbs: BreadcrumbsWithDetails,
    filterOptions: Array<FilterOptions[0][0] | FilterOptions[1][0]>
  ) {
    return breadcrumbs.filter(b => {
      const crumbProperty = b[type];
      if (!crumbProperty) {
        return true;
      }
      const foundInFilterOptions = filterOptions.find(f => f.type === crumbProperty);

      if (foundInFilterOptions) {
        return foundInFilterOptions.isChecked;
      }

      return false;
    });
  }

  getFilteredCrumbs(
    hasCheckedType: boolean,
    hasCheckedLevel: boolean,
    filterOptions: FilterOptions
  ) {
    const {breadcrumbs} = this.state;

    if (!hasCheckedType && !hasCheckedLevel) {
      return breadcrumbs;
    }

    if (hasCheckedType) {
      const filteredCrumbsByType = this.filterCrumbsBy(
        'type',
        breadcrumbs,
        filterOptions[0]
      );

      if (hasCheckedLevel) {
        const filteredCrumbsByLevel = this.filterCrumbsBy(
          'level',
          filteredCrumbsByType,
          filterOptions[1]
        );

        return filteredCrumbsByLevel;
      }

      return filteredCrumbsByType;
    }

    const filteredCrumbsByLevel = this.filterCrumbsBy(
      'level',
      breadcrumbs,
      filterOptions[1]
    );

    return filteredCrumbsByLevel;
  }

  handleSearch = (value: string) => {
    this.setState(prevState => ({
      searchTerm: value,
      filteredBySearch: this.filterBySearch(value, prevState.filteredByFilter),
    }));
  };

  handleFilter = (filterOptions: FilterOptions) => {
    const hasCheckedType = filterOptions[0].some(filterOption => filterOption.isChecked);
    const hasCheckedLevel = filterOptions[1].some(filterOption => filterOption.isChecked);

    const filteredCrumbs = this.getFilteredCrumbs(
      hasCheckedType,
      hasCheckedLevel,
      filterOptions
    );

    this.setState(prevState => ({
      filterOptions,
      filteredByFilter: filteredCrumbs,
      filteredBySearch: this.filterBySearch(prevState.searchTerm, filteredCrumbs),
    }));
  };

  handleSwitchTimeFormat = () => {
    this.setState(prevState => ({
      displayRelativeTime: !prevState.displayRelativeTime,
    }));
  };

  handleCleanSearch = () => {
    this.setState({
      searchTerm: '',
    });
  };

  handleResetFilter = () => {
    this.setState(prevState => ({
      filteredByFilter: prevState.breadcrumbs,
      filterOptions: prevState.filterOptions.map(filterOption =>
        (filterOption as Array<FilterOptions[0][0] | FilterOptions[1][0]>).map(
          option => ({
            ...option,
            isChecked: false,
          })
        )
      ) as FilterOptions,
      filteredBySearch: this.filterBySearch(prevState.searchTerm, prevState.breadcrumbs),
    }));
  };

  render() {
    const {type, event, orgId} = this.props;
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
          <GuideAnchor target="breadcrumbs" position="bottom">
            <h3>{t('Breadcrumbs')}</h3>
          </GuideAnchor>
        }
        actions={
          <Search>
            <Filter onFilter={this.handleFilter} options={filterOptions} />
            <StyledSearchBar
              placeholder={t('Search breadcrumbs\u2026')}
              onSearch={this.handleSearch}
            />
          </Search>
        }
        wrapTitle={false}
        isCentered
      >
        {filteredBySearch.length > 0 ? (
          <List
            breadcrumbs={filteredBySearch}
            event={event}
            orgId={orgId}
            onSwitchTimeFormat={this.handleSwitchTimeFormat}
            displayRelativeTime={displayRelativeTime}
            searchTerm={searchTerm}
            relativeTime={relativeTime!} // relativeTime has to be always available, as the last item timestamp is the event created time
          />
        ) : (
          <StyledEmptyMessage
            icon={<IconWarning size="xl" />}
            action={
              <Button onClick={this.handleResetFilter} priority="primary">
                {t('Reset Filter')}
              </Button>
            }
          >
            {t('Sorry, no breadcrumbs match your search query.')}
          </StyledEmptyMessage>
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

const Search = styled('div')`
  display: flex;
  width: 100%;
  margin-top: ${space(1)};

  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    width: 400px;
    margin-top: 0;
  }

  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 600px;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  width: 100%;
  .search-input {
    height: 32px;
  }
  .search-input,
  .search-input:focus {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }
`;
