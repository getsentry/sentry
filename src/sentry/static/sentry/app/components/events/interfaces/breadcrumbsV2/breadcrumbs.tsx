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

import {
  Breadcrumb,
  BreadcrumbDetails,
  BreadcrumbType,
  BreadcrumbLevelType,
} from '../breadcrumbs/types';
import BreadcrumbFilter from './breadcrumbFilter/breadcrumbFilter';
import convertBreadcrumbType from './convertBreadcrumbType';
import getBreadcrumbTypeDetails from './getBreadcrumbTypeDetails';
import {FilterGroupType} from './breadcrumbFilter/types';
import BreadcrumbsListHeader from './breadcrumbsListHeader';
import BreadcrumbsListBody from './breadcrumbsListBody';
import BreadcrumbLevel from './breadcrumbLevel';
import BreadcrumbIcon from './breadcrumbIcon';

const MAX_CRUMBS_WHEN_COLLAPSED = 10;

type BreadcrumbWithDetails = Breadcrumb & BreadcrumbDetails & {id: number};
type BreadcrumbFilterGroups = React.ComponentProps<
  typeof BreadcrumbFilter
>['filterGroups'];

type State = {
  isCollapsed: boolean;
  searchTerm: string;
  breadcrumbs: Array<BreadcrumbWithDetails>;
  filteredByFilter: Array<BreadcrumbWithDetails>;
  filteredByCustomSearch: Array<BreadcrumbWithDetails>;
  filteredBreadcrumbs: Array<BreadcrumbWithDetails>;
  filterGroups: BreadcrumbFilterGroups;
};

type Props = {
  event: Event;
  type: string;
  data: {
    values: Array<Breadcrumb>;
  };
};

class BreadcrumbsContainer extends React.Component<Props, State> {
  state: State = {
    isCollapsed: true,
    searchTerm: '',
    breadcrumbs: [],
    filteredByFilter: [],
    filteredByCustomSearch: [],
    filteredBreadcrumbs: [],
    filterGroups: [],
  };

  componentDidMount() {
    this.loadBreadcrumbs();
  }

  loadBreadcrumbs = () => {
    const {data} = this.props;
    let breadcrumbs = data.values;

    // Add the error event as the final (virtual) breadcrumb
    const virtualCrumb = this.getVirtualCrumb();
    if (virtualCrumb) {
      breadcrumbs = [...breadcrumbs, virtualCrumb];
    }

    const breadcrumbTypes: BreadcrumbFilterGroups = [];
    const breadcrumbLevels: BreadcrumbFilterGroups = [];

    const convertedBreadcrumbs = breadcrumbs.map((breadcrumb, index) => {
      const convertedBreadcrumb = convertBreadcrumbType(breadcrumb);
      const breadcrumbTypeDetails = getBreadcrumbTypeDetails(convertedBreadcrumb.type);

      if (!breadcrumbTypes.find(b => b.type === convertedBreadcrumb.type)) {
        breadcrumbTypes.push({
          groupType: FilterGroupType.TYPE,
          type: convertedBreadcrumb.type,
          description: breadcrumbTypeDetails.description,
          symbol: (
            <BreadcrumbIcon {...omit(breadcrumbTypeDetails, 'description')} size="xs" />
          ),
          isChecked: true,
        });
      }

      if (!breadcrumbLevels.find(b => b.type === String(convertedBreadcrumb?.level))) {
        breadcrumbLevels.push({
          groupType: FilterGroupType.LEVEL,
          type: String(convertedBreadcrumb?.level) as BreadcrumbLevelType,
          symbol: <BreadcrumbLevel level={convertedBreadcrumb.level} />,
          isChecked: true,
        });
      }

      return {
        id: index,
        ...convertedBreadcrumb,
        ...breadcrumbTypeDetails,
      };
    });

    this.setState({
      breadcrumbs: convertedBreadcrumbs,
      filteredBreadcrumbs: convertedBreadcrumbs,
      filteredByFilter: convertedBreadcrumbs,
      filteredByCustomSearch: convertedBreadcrumbs,
      filterGroups: [
        ...breadcrumbTypes
          // in case of a breadcrumb of type BreadcrumbType.DEFAULT, moves it to the last position of the array
          .filter(crumbType => crumbType.type !== BreadcrumbType.DEFAULT)
          .concat(
            breadcrumbTypes.filter(crumbType => crumbType.type === BreadcrumbType.DEFAULT)
          ),
        ...breadcrumbLevels,
      ],
    });
  };

  moduleToCategory = (module: any) => {
    if (!module) {
      return undefined;
    }
    const match = module.match(/^.*\/(.*?)(:\d+)/);
    if (!match) {
      return module.split(/./)[0];
    }
    return match[1];
  };

  getVirtualCrumb = (): Breadcrumb | undefined => {
    const {event} = this.props;

    const exception = event.entries.find(
      entry => entry.type === BreadcrumbType.EXCEPTION
    );

    if (!exception && !event.message) {
      return undefined;
    }

    if (exception) {
      const {type, value, module: mdl} = exception.data.values[0];
      return {
        type: BreadcrumbType.EXCEPTION,
        level: BreadcrumbLevelType.ERROR,
        category: this.moduleToCategory(mdl) || 'exception',
        data: {
          type,
          value,
        },
        timestamp: event.dateCreated,
      };
    }

    const levelTag = (event.tags || []).find(tag => tag.key === 'level');

    return {
      type: BreadcrumbType.MESSAGE,
      level: levelTag?.value as BreadcrumbLevelType,
      category: 'message',
      message: event.message,
      timestamp: event.dateCreated,
    };
  };

  getCollapsedCrumbQuantity = (): {
    filteredCollapsedBreadcrumbs: Array<BreadcrumbWithDetails>;
    collapsedQuantity: number;
  } => {
    const {isCollapsed, filteredBreadcrumbs} = this.state;

    let filteredCollapsedBreadcrumbs = filteredBreadcrumbs;

    if (isCollapsed && filteredCollapsedBreadcrumbs.length > MAX_CRUMBS_WHEN_COLLAPSED) {
      filteredCollapsedBreadcrumbs = filteredCollapsedBreadcrumbs.slice(
        -MAX_CRUMBS_WHEN_COLLAPSED
      );
    }

    return {
      filteredCollapsedBreadcrumbs,
      collapsedQuantity: filteredBreadcrumbs.length - filteredCollapsedBreadcrumbs.length,
    };
  };

  handleFilter = (filterGroups: BreadcrumbFilterGroups) => () => {
    //types
    const breadcrumbFilterGroupTypes = filterGroups
      .filter(
        breadcrumbFilterGroup =>
          breadcrumbFilterGroup.groupType === 'type' && breadcrumbFilterGroup.isChecked
      )
      .map(breadcrumbFilterGroup => breadcrumbFilterGroup.type);

    //levels
    const breadcrumbFilterGroupLevels = filterGroups
      .filter(
        breadcrumbFilterGroup =>
          breadcrumbFilterGroup.groupType === 'level' && breadcrumbFilterGroup.isChecked
      )
      .map(breadcrumbFilterGroup => breadcrumbFilterGroup.type);

    const filteredByFilter = this.state.breadcrumbs.filter(({type, level}) => {
      if (
        breadcrumbFilterGroupLevels.length > 0 &&
        breadcrumbFilterGroupTypes.length > 0
      ) {
        return (
          breadcrumbFilterGroupTypes.includes(type) ||
          breadcrumbFilterGroupLevels.includes(String(level) as BreadcrumbLevelType)
        );
      }

      if (breadcrumbFilterGroupLevels.length > 0) {
        return breadcrumbFilterGroupLevels.includes(String(level) as BreadcrumbLevelType);
      }

      return breadcrumbFilterGroupTypes.includes(type);
    });

    this.setState(
      {
        filteredByFilter,
        filterGroups,
      },
      () => {
        this.handleFilterBySearchTerm(this.state.searchTerm);
      }
    );
  };

  handleFilterBySearchTerm = (value: string) => {
    const {filteredByCustomSearch} = this.state;

    const searchTerm = value.toLocaleLowerCase();

    const filteredBreadcrumbs = filteredByCustomSearch.filter(obj => {
      return Object.keys(
        pick(obj, ['type', 'category', 'message', 'level', 'timestamp', 'data'])
      ).some(key => {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return String(obj[key])
            .toLocaleLowerCase()
            .includes(searchTerm);
        }
        if (typeof obj[key] === 'object') {
          return (
            JSON.stringify(obj)
              .toLocaleLowerCase()
              .indexOf(searchTerm) !== -1
          );
        }
        return false;
      });
    });

    this.setState({
      searchTerm,
      filteredBreadcrumbs,
    });
  };

  handleToggleCollapse = () => {
    this.setState(prevState => ({
      isCollapsed: !prevState.isCollapsed,
    }));
  };

  handleCleanSearch = () => {
    this.setState({
      searchTerm: '',
      isCollapsed: true,
    });
  };

  handleResetFilter = () => {
    this.setState(
      prevState => ({
        filteredByFilter: prevState.breadcrumbs,
        filterGroups: prevState.filterGroups.map(filterGroup => ({
          ...filterGroup,
          isChecked: true,
        })),
      }),
      () => {
        this.handleFilterBySearchTerm(this.state.searchTerm);
      }
    );
  };

  render() {
    const {type} = this.props;
    const {filterGroups, searchTerm} = this.state;

    const {
      collapsedQuantity,
      filteredCollapsedBreadcrumbs,
    } = this.getCollapsedCrumbQuantity();

    return (
      <EventDataSection
        type={type}
        title={
          <h3>
            <GuideAnchor target="breadcrumbs" position="bottom">
              {t('Breadcrumbs')}
            </GuideAnchor>
          </h3>
        }
        actions={
          <Search>
            <BreadcrumbFilter onFilter={this.handleFilter} filterGroups={filterGroups} />
            <StyledSearchBar
              placeholder={t('Search breadcrumbs\u2026')}
              onChange={this.handleFilterBySearchTerm}
              query={searchTerm}
            />
          </Search>
        }
        wrapTitle={false}
        isCentered
      >
        <Content>
          {filteredCollapsedBreadcrumbs.length > 0 ? (
            <BreadcrumbList>
              <BreadcrumbsListHeader />
              <BreadcrumbsListBody
                onToggleCollapse={this.handleToggleCollapse}
                collapsedQuantity={collapsedQuantity}
                breadcrumbs={filteredCollapsedBreadcrumbs}
              />
            </BreadcrumbList>
          ) : (
            <EmptyMessage
              icon={<IconWarning size="xl" />}
              action={
                <Button onClick={this.handleResetFilter} priority="primary">
                  {t('Reset Filter')}
                </Button>
              }
            >
              {t('Sorry, no breadcrumbs match your search query.')}
            </EmptyMessage>
          )}
        </Content>
      </EventDataSection>
    );
  }
}

export default BreadcrumbsContainer;

const Content = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: ${space(3)};
`;

const BreadcrumbList = styled('ul')`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
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
  .icon-search {
    top: 0 !important;
    height: 32px;
    display: flex;
    align-items: center;
  }
`;
