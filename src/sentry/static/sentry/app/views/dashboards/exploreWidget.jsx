import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import {IconChevron, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import {getDiscover2UrlPathFromDiscoverQuery} from 'app/views/dashboards/utils/getDiscoverUrlPathFromDiscoverQuery';

class ExploreWidget extends React.Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  };

  getExportToDiscover = query => {
    const {selection, organization} = this.props;
    return getDiscover2UrlPathFromDiscoverQuery({organization, selection, query});
  };

  renderActionToDiscover(query) {
    return (
      <ExploreAction
        to={this.getExportToDiscover(query)}
        title={t('Explore data in Discover')}
      >
        <IconOpen />
      </ExploreAction>
    );
  }

  render() {
    const {widget} = this.props;
    const discoverQueries = widget.queries.discover;

    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <ExploreRoot {...getRootProps()} isOpen={isOpen}>
            <div {...getActorProps()}>
              <ExploreButton isOpen={isOpen}>
                {t('Explore Data')}
                <Chevron
                  isOpen={isOpen}
                  direction={isOpen ? 'down' : 'right'}
                  size="xs"
                />
              </ExploreButton>
            </div>
            <ExploreMenu {...getMenuProps({isOpen})}>
              {discoverQueries.map(query => (
                <ExploreRow key={query.name}>
                  <QueryName>{query.name}</QueryName>

                  {this.renderActionToDiscover(query)}
                </ExploreRow>
              ))}
            </ExploreMenu>
          </ExploreRoot>
        )}
      </DropdownMenu>
    );
  }
}
export default withOrganization(ExploreWidget);

const ExploreRoot = styled('div')`
  border-left: 1px solid ${p => p.theme.border};
  position: relative;
  ${p => p.isOpen && 'filter: drop-shadow(-7px -7px 12px rgba(47, 40, 55, 0.04));'};
`;

const ExploreAction = props => <Button priority="link" {...props} />;

const ExploreButton = styled(props => {
  const remaining = omit(props, 'isOpen');
  return <ExploreAction {...remaining} />;
})`
  position: relative;
  color: ${p => (p.isOpen ? p.theme.purple300 : p.theme.gray300)};
  padding: ${space(1)} ${space(2)};
  border-radius: 0 0 ${p => p.theme.borderRadius} 0;
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};

  &:hover {
    color: ${p => p.theme.purple300};
  }

  /* covers up borders to create a continous shape */
  ${p => (p.isOpen ? '&, &:hover, &:active { box-shadow: 0 -1px 0 #fff; }' : '')}
`;

const ExploreMenu = styled('div')`
  visibility: ${p => (p.isOpen ? 'visible' : 'hidden')};
  display: flex;
  flex-direction: column;
  min-width: 250px;

  position: absolute;
  right: -1px;
  bottom: 100%;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
`;

const ExploreRow = styled('li')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)};
`;

const QueryName = styled('span')`
  flex-grow: 1;
  white-space: nowrap;
  font-size: 0.9em;
  margin: ${space(1)};
  margin-right: ${space(2)};
`;

const Chevron = styled(IconChevron, {shouldForwardProp: prop => prop !== 'isOpen'})`
  ${p => (p.isOpen ? 'transform: rotate(180deg);' : '')};
  margin-left: ${p => (p.isOpen ? space(0.5) : space(0.25))};
  transition: all 0.25s;
`;
