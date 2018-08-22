import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {openDocsSearchModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import SidebarItem from 'app/components/sidebar/sidebarItem';
import HookStore from 'app/stores/hookStore';

import SidebarMenuItem from './sidebarMenuItem';
import SidebarDropdownMenu from './sidebarDropdownMenu.styled';

class SidebarHelp extends React.Component {
  static propTypes = {
    orientation: PropTypes.oneOf(['top', 'left']),
    collapsed: PropTypes.bool,
    hidePanel: PropTypes.func,
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.state = {
      supportMenuItem: null,
    };
  }

  componentDidMount() {
    if (this.props.organization) {
      HookStore.get('sidebar:contact-support').map(cb =>
        cb(
          this.props.organization,
          <SidebarMenuItem>{t('Contact Support')}</SidebarMenuItem>,
          this.handleSupportHookUpdate
        )
      );
    }
  }

  handleSupportHookUpdate = menuItem => {
    this.setState({
      supportMenuItem: menuItem,
    });
  };

  handleActorClick = () => {
    this.props.hidePanel();
  };

  handleSearchClick = () => {
    openDocsSearchModal();
  };

  render() {
    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          return (
            <HelpRoot>
              <HelpActor
                {...getActorProps({onClick: this.handleActorClick, isStyled: true})}
              >
                <SidebarItem
                  orientation={this.props.orientation}
                  collapsed={this.props.collapsed}
                  hasPanel={false}
                  icon={<InlineSvg src="icon-circle-question" />}
                  label={t('Help')}
                />
              </HelpActor>

              {isOpen && (
                <HelpMenu {...getMenuProps({isStyled: true})}>
                  <React.Fragment>
                    {this.state.supportMenuItem}
                    <SidebarMenuItem onClick={this.handleSearchClick}>
                      {t('Search Docs and FAQs')}
                    </SidebarMenuItem>
                    <SidebarMenuItem href="https://forum.sentry.io/" target="_blank">
                      {t('Community Discussions')}
                    </SidebarMenuItem>
                    <SidebarMenuItem href="https://status.sentry.io/" target="_blank">
                      {t('Service Status')}
                    </SidebarMenuItem>
                  </React.Fragment>
                </HelpMenu>
              )}
            </HelpRoot>
          );
        }}
      </DropdownMenu>
    );
  }
}

export default SidebarHelp;

const HelpRoot = styled('div')`
  position: relative;
`;

const HelpActor = styled('div')``;

const HelpMenu = styled('div')`
  ${SidebarDropdownMenu};
  bottom: 100%;
`;
