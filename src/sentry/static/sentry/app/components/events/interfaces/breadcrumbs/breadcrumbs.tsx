import React from 'react';
import styled from '@emotion/styled';

import EventDataSection from 'app/components/events/eventDataSection';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Event} from 'app/types';
import space from 'app/styles/space';
import {IconProps} from 'app/types/iconProps';

import {PlatformContextProvider} from './platformContext';
import BreadcrumbTime from './breadcrumbTime';
import BreadcrumbCollapsed from './breadcrumbCollapsed';
import BreadcrumbRenderer from './breadcrumbRenderer';
import convertBreadcrumbType from './convertBreadcrumbType';
import getBreadcrumbDetails from './getBreadcrumbDetails';
import BreadcrumbFilter from './breadcrumbFilter/breadcrumbFilter';
import {Breadcrumb, BreadcrumbDetails} from './types';
import {BreadCrumb, BreadCrumbIconWrapper} from './styles';

const MAX_CRUMBS_WHEN_COLLAPSED = 10;

type BreadcrumbWithDetails = Breadcrumb & BreadcrumbDetails;
type BreadcrumbFilterData = React.ComponentProps<typeof BreadcrumbFilter>['filterData'];

type State = {
  isCollapsed: boolean;
  searchTerm: string;
  breadcrumbs: Array<BreadcrumbWithDetails>;
  filteredBreadcrumbs: Array<BreadcrumbWithDetails>;
  breadcrumbFilterData: BreadcrumbFilterData;
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
    filteredBreadcrumbs: [],
    breadcrumbFilterData: [],
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

    const breadcrumbFilterData: BreadcrumbFilterData = [];

    const convertedBreadcrumbs = breadcrumbs.map(breadcrumb => {
      const convertedBreadcrumb = convertBreadcrumbType(breadcrumb);
      const breadcrumbDetails = getBreadcrumbDetails(convertedBreadcrumb.type);

      if (!breadcrumbFilterData.find(b => b.type === convertedBreadcrumb.type)) {
        breadcrumbFilterData.push({
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
      breadcrumbFilterData,
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

  handleChangeSearchTerm = (searchTerm: string) => {
    const {breadcrumbs} = this.state;

    const filteredBreadcrumbs = breadcrumbs.filter(
      item =>
        // return true if any of category, message, or level contain queryValue
        !!['category', 'message', 'level'].find(prop => {
          const propValue = (item[prop] || '').toLowerCase();
          return propValue.includes(searchTerm);
        })
    );

    this.setState({
      searchTerm,
      filteredBreadcrumbs,
    });
  };

  handleFilter = (breadcrumbFilterData: BreadcrumbFilterData) => () => {
    this.setState(prevState => ({
      filteredBreadcrumbs: prevState.breadcrumbs.filter(breadcrumb => {
        const foundBreadcrumbFilterData = breadcrumbFilterData.find(
          crumbFilterData => crumbFilterData.type === breadcrumb.type
        );
        if (foundBreadcrumbFilterData) {
          return foundBreadcrumbFilterData.isChecked;
        }

        return false;
      }),
      breadcrumbFilterData,
    }));
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
    const {breadcrumbFilterData} = this.state;

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
          <BreadcrumbFilter
            onFilter={this.handleFilter}
            filterData={breadcrumbFilterData}
          />
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
