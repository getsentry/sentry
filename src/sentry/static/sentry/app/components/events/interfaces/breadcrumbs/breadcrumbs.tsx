import React from 'react';
import styled from '@emotion/styled';

import EventDataSection from 'app/components/events/eventDataSection';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Event} from 'app/types';
import space from 'app/styles/space';

import {PlatformContextProvider} from './platformContext';
import BreadCrumbsSearch from './breadcrumbsSearch';
import BreadcrumbTime from './breadcrumbTime';
import BreadcrumbCollapsed from './breadcrumbCollapsed';
import convertBreadcrumbType from './convertBreadcrumbType';
import getBreadcrumbDetails from './getBreadcrumbDetails';
import {Breadcrumb, BreadcrumbType, BreadcrumbLevelType} from './types';
import {BreadCrumb, BreadCrumbIconWrapper} from './styles';

const MAX_CRUMBS_WHEN_COLLAPSED = 10;

type State = {
  isCollapsed: boolean;
  searchTerm: string;
  breadcrumbs: Array<Breadcrumb>;
  filteredBreadcrumbs: Array<Breadcrumb>;
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
  };

  componentDidMount() {
    this.loadCrumbs();
  }

  loadCrumbs = () => {
    const {data} = this.props;
    let breadcrumbs = data.values;

    // Add the error event as the final (virtual) breadcrumb
    const virtualCrumb = this.getVirtualCrumb();
    if (virtualCrumb) {
      breadcrumbs = [...data.values, virtualCrumb];
    }

    this.setState({
      breadcrumbs,
      filteredBreadcrumbs: breadcrumbs,
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
        type: BreadcrumbType.ERROR,
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
    filteredCollapsedBreadcrumbs: Array<Breadcrumb>;
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
    const {searchTerm} = this.state;
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
          <BreadCrumbsSearch
            searchTerm={searchTerm}
            onChangeSearchTerm={value => {
              this.handleChangeSearchTerm(value as string);
            }}
            onClearSearchTerm={this.handleCleanSearch}
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
                {filteredCollapsedBreadcrumbs.map((crumb, idx) => {
                  const convertedBreadcrumb = convertBreadcrumbType(crumb);
                  const {color, borderColor, icon, renderer} = getBreadcrumbDetails(
                    convertedBreadcrumb
                  );

                  return (
                    <BreadCrumb
                      data-test-id="breadcrumb"
                      key={idx}
                      hasError={
                        convertedBreadcrumb.type === BreadcrumbType.MESSAGE ||
                        convertedBreadcrumb.type === BreadcrumbType.ERROR
                      }
                    >
                      <BreadCrumbIconWrapper color={color} borderColor={borderColor}>
                        {icon}
                      </BreadCrumbIconWrapper>
                      {renderer}
                      <BreadcrumbTime timestamp={crumb.timestamp} />
                    </BreadCrumb>
                  );
                })}
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
