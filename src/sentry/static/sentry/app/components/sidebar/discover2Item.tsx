import React from 'react';
import styled from 'react-emotion';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import {fetchSavedQueries} from 'app/actionCreators/discoverSavedQueries';
import Link from 'app/components/links/link';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {SavedQuery} from 'app/views/discover/types';
import EventView from 'app/views/eventsV2/eventView';

import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import withApi from 'app/utils/withApi';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';

import SidebarItem from './sidebarItem';

type Props = React.ComponentProps<SidebarItem> & {
  api: Client;
  organization: Organization;
  savedQueries: SavedQuery[];
};

type State = {
  isOpen: boolean;
};

class Discover2Item extends React.Component<Props, State> {
  state = {
    isOpen: false,
  };

  componentDidMount() {
    const {api, organization} = this.props;
    fetchSavedQueries(api, organization.slug);
  }

  handleEnter = () => {
    this.setState({isOpen: true});
  };

  handleLeave = () => {
    this.setState({isOpen: false});
  };

  renderSavedQueries() {
    const {savedQueries, organization} = this.props;
    if (!savedQueries || savedQueries.length === 0) {
      return <span>No saved queries</span>;
    }
    return savedQueries.map(item => {
      const target = {
        pathname: `/organizations/${organization.slug}/eventsv2/`,
        query: EventView.fromSavedQuery(item).generateQueryStringObject(),
      };
      return (
        <MenuItem aria-role="menuitem" to={target} key={item.id}>
          {item.name}
        </MenuItem>
      );
    });
  }

  render() {
    const {organization, savedQueries: _, ...sidebarItemProps} = this.props;
    const {isOpen} = this.state;
    const navProps = {
      'aria-label': t('Discover Saved Queries'),
      'aria-haspopup': true,
      onMouseLeave: this.handleLeave,
      onMouseEnter: this.handleEnter,
    };
    if (isOpen) {
      navProps['aria-expanded'] = 'true';
    }

    const sidebarItem = <SidebarItem {...sidebarItemProps} />;
    return (
      <Feature
        features={['discover-v2-query-builder']}
        organization={organization}
        renderDisabled={() => sidebarItem}
      >
        <nav {...navProps}>
          {sidebarItem}
          <Hitbox isOpen={isOpen}>
            <Menu aria-role="menu">{this.renderSavedQueries()}</Menu>
          </Hitbox>
        </nav>
      </Feature>
    );
  }
}

export default withApi(withDiscoverSavedQueries(Discover2Item));

type HitboxCustomProps = {
  isOpen: boolean;
};
type HitboxProps = Omit<React.HTMLProps<HTMLDivElement>, keyof HitboxCustomProps> &
  HitboxCustomProps;

const Hitbox = styled('div')<HitboxProps>`
  display: ${p => (p.isOpen ? 'block' : 'none')};
  position: absolute;
  right: -330px;
  width: 350px;
  height: 200px;
  padding-left: ${space(3)};
  transform: translateY(-30px);
`;

const Menu = styled('div')`
  height: 100%;
  background: ${p => p.theme.gray4};
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  border: 1px solid ${p => p.theme.sidebar.background};
`;

const MenuItem = styled(Link)`
  display: block;
  padding: ${space(1)} ${space(2)};
  color: ${p => p.theme.sidebar.color};
  border-bottom: 1px solid ${p => p.theme.gray3};
  &:focus,
  &:hover {
    color: ${p => p.theme.gray1};
  }
  ${overflowEllipsis};
`;
