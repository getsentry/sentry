import React from 'react';
import styled from '@emotion/styled';

import EventDataSection from 'app/components/events/eventDataSection';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Event} from 'app/types';
import space from 'app/styles/space';
import SimpleSmartSearch from 'app/components/simpleSmartSearch/simpleSmartSearch';
import {IconProps} from 'app/types/iconProps';

import {PlatformContextProvider} from './platformContext';
import BreadcrumbTime from './breadcrumbTime';
import BreadcrumbCollapsed from './breadcrumbCollapsed';
import BreadcrumbRenderer from './breadcrumbRenderer';
import convertBreadcrumbType from './convertBreadcrumbType';
import getBreadcrumbDetails from './getBreadcrumbDetails';
import BreadcrumbCustomSearch from './breadcrumbCustomSearch/breadcrumbCustomSearch';
import {Breadcrumb, BreadcrumbDetails} from './types';
import {BreadCrumb, BreadCrumbIconWrapper} from './styles';

const MAX_CRUMBS_WHEN_COLLAPSED = 10;

type BreadcrumbWithDetails = Breadcrumb & BreadcrumbDetails;
type BreadcrumbCustomSearchData = React.ComponentProps<
  typeof BreadcrumbCustomSearch
>['customSearchData'];

type State = {
  isCollapsed: boolean;
  searchTerm: string;
  breadcrumbs: Array<BreadcrumbWithDetails>;
  filteredBreadcrumbsByCustomSearch: Array<BreadcrumbWithDetails>;
  filteredBreadcrumbs: Array<BreadcrumbWithDetails>;
  breadcrumbCustomSearchData: BreadcrumbCustomSearchData;
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
    filteredBreadcrumbsByCustomSearch: [],
    filteredBreadcrumbs: [],
    breadcrumbCustomSearchData: [],
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

    const breadcrumbCustomSearchData: BreadcrumbCustomSearchData = [];

    const convertedBreadcrumbs = breadcrumbs.map(breadcrumb => {
      const convertedBreadcrumb = convertBreadcrumbType(breadcrumb);
      const breadcrumbDetails = getBreadcrumbDetails(convertedBreadcrumb.type);

      if (!breadcrumbCustomSearchData.find(b => b.type === convertedBreadcrumb.type)) {
        breadcrumbCustomSearchData.push({
          type: convertedBreadcrumb.type,
          ...breadcrumbDetails,
          isChecked: true,
        });
      }

      return {
        ...convertedBreadcrumb,
        ...breadcrumbDetails,
      };
    });

    this.setState({
      breadcrumbs: convertedBreadcrumbs,
      filteredBreadcrumbs: convertedBreadcrumbs,
      filteredBreadcrumbsByCustomSearch: convertedBreadcrumbs,
      breadcrumbCustomSearchData,
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

    const exception = event.entries.find(entry => entry.type === 'exception');

    if (!exception && !event.message) {
      return undefined;
    }

    if (exception) {
      const {type, value, module: mdl} = exception.data.values[0];
      return {
        type: 'error',
        level: 'error',
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
      type: 'message',
      level: levelTag?.value as Breadcrumb['level'],
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

  handleFilterByCustomSearch = (
    breadcrumbCustomSearchData: BreadcrumbCustomSearchData
  ) => () => {
    this.setState({
      filteredBreadcrumbsByCustomSearch: this.state.breadcrumbs.filter(breadcrumb => {
        const foundBreadcrumbFilterData = breadcrumbCustomSearchData.find(
          crumbFilterData => crumbFilterData.type === breadcrumb.type
        );
        if (foundBreadcrumbFilterData) {
          return foundBreadcrumbFilterData.isChecked;
        }

        return false;
      }),
      breadcrumbCustomSearchData,
    });
  };

  handleChangeSearchTerm = (value: string) => {
    const {filteredBreadcrumbsByCustomSearch} = this.state;

    const searchTerm = value.toLocaleLowerCase();

    const filteredBreadcrumbs = filteredBreadcrumbsByCustomSearch.filter(
      item =>
        !!['category', 'message', 'level', 'timestamp'].find(prop => {
          const searchValue = item[prop];
          if (searchValue) {
            return searchValue.toLowerCase().indexOf(searchTerm) !== -1;
          }
          return false;
        })
    );

    this.setState({
      searchTerm,
      filteredBreadcrumbs,
    });
  };

  handleCollapseToggle = () => {
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

  render() {
    const {event, type} = this.props;
    const {breadcrumbCustomSearchData} = this.state;

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
            <BreadcrumbCustomSearch
              onFilter={this.handleFilterByCustomSearch}
              customSearchData={breadcrumbCustomSearchData}
            />
            <SimpleSmartSearch
              showMaxResultQuantity={5}
              placeholder={t('Search breadcrumbs...')}
              onChange={this.handleChangeSearchTerm}
              hasRecentSearches
            />
          </Search>
        }
        wrapTitle={false}
      >
        <Content>
          {filteredCollapsedBreadcrumbs.length > 0 ? (
            <PlatformContextProvider value={{platform: event.platform}}>
              <BreadCrumbs className="crumbs">
                {collapsedQuantity > 0 && (
                  <BreadcrumbCollapsed
                    onClick={this.handleCollapseToggle}
                    quantity={collapsedQuantity}
                  />
                )}
                {filteredCollapsedBreadcrumbs.map(
                  ({color, borderColor, icon, ...crumb}, idx) => {
                    const Icon = icon as React.ComponentType<IconProps>;
                    return (
                      <BreadCrumb
                        data-test-id="breadcrumb"
                        key={idx}
                        hasError={crumb.type === 'message' || crumb.type === 'error'}
                      >
                        <BreadCrumbIconWrapper color={color} borderColor={borderColor}>
                          <Icon />
                        </BreadCrumbIconWrapper>
                        <BreadcrumbRenderer breadcrumb={crumb as Breadcrumb} />
                        <BreadcrumbTime timestamp={crumb.timestamp} />
                      </BreadCrumb>
                    );
                  }
                )}
              </BreadCrumbs>
            </PlatformContextProvider>
          ) : (
            <EmptyStateWarning small>
              {t('Sorry, no breadcrumbs match your search query.')}
            </EmptyStateWarning>
          )}
        </Content>
      </EventDataSection>
    );
  }
}

export default BreadcrumbsContainer;

const BreadCrumbs = styled('ul')`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
`;

const Content = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: ${space(3)};
`;

// const SmartSearchBarNoLeftCorners = styled(SimpleSmartSearch)`
//   border-radius: ${p =>
//     p.isOpen
//       ? `0 ${p.theme.borderRadius} 0 0`
//       : `0 ${p.theme.borderRadius} ${p.theme.borderRadius} 0`};
//   flex-grow: 1;
// `;

const Search = styled('div')`
  display: flex;
  min-width: 100vh;
`;
