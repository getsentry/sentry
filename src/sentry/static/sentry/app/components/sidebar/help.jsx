import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import {openHelpSearchModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import DropdownMenu from 'app/components/dropdownMenu';
import SidebarItem from 'app/components/sidebar/sidebarItem';
import Hook from 'app/components/hook';
import {IconQuestion} from 'app/icons/iconQuestion';

import SidebarMenuItem from './sidebarMenuItem';
import SidebarDropdownMenu from './sidebarDropdownMenu.styled';

class SidebarHelp extends React.Component {
  static propTypes = {
    orientation: PropTypes.oneOf(['top', 'left']),
    collapsed: PropTypes.bool,
    hidePanel: PropTypes.func,
    organization: SentryTypes.Organization,
  };

  handleActorClick = () => {
    this.props.hidePanel();
  };

  handleSearchClick = () => {
    openHelpSearchModal();
  };

  render() {
    return (
      <DropdownMenu>
        {({isOpen, getActorProps, getMenuProps}) => {
          return (
            <HelpRoot>
              <HelpActor {...getActorProps({onClick: this.handleActorClick})}>
                <SidebarItem
                  orientation={this.props.orientation}
                  collapsed={this.props.collapsed}
                  hasPanel={false}
                  icon={<IconQuestion size="md" />}
                  label={t('Help')}
                  id="help"
                />
              </HelpActor>

              {isOpen && (
                <HelpMenu {...getMenuProps()}>
                  <Hook name="sidebar:help-menu" organization={this.props.organization} />
                  <SidebarMenuItem onClick={this.handleSearchClick}>
                    {t('Search Docs and FAQs')}
                  </SidebarMenuItem>
                  <SidebarMenuItem href="https://forum.sentry.io/" target="_blank">
                    {t('Community Discussions')}
                  </SidebarMenuItem>
                  <SidebarMenuItem href="https://status.sentry.io/" target="_blank">
                    {t('Service Status')}
                  </SidebarMenuItem>
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

// This exists to provide a styled actor for the dropdown. Making the actor a regular,
// non-styled react component causes some issues with toggling correctly because of
// how refs are handled.
const HelpActor = styled('div')``;

const HelpMenu = styled('div')`
  ${SidebarDropdownMenu};
  bottom: 100%;
`;
