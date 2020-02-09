import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import DropdownMenu from 'app/components/dropdownMenu';
import SentryTypes from 'app/sentryTypes';
import withOrganizations from 'app/utils/withOrganizations';
import SidebarOrgSummary from 'app/components/sidebar/sidebarOrgSummary';
import SidebarMenuItem from 'app/components/sidebar/sidebarMenuItem';
import SidebarDropdownMenu from 'app/components/sidebar/sidebarDropdownMenu.styled';
import {IconAdd} from 'app/icons/iconAdd';

import Divider from './divider.styled';

/**
 * Switch Organization Menu Label + Sub Menu
 */
class SwitchOrganization extends React.Component {
  static propTypes = {
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
    canCreateOrganization: PropTypes.bool,
  };

  render() {
    const {organizations, canCreateOrganization} = this.props;
    const hasOrganizations = organizations && !!organizations.length;

    return (
      <DropdownMenu isNestedDropdown>
        {({isOpen, getMenuProps, getActorProps}) => {
          return (
            <React.Fragment>
              <SwitchOrganizationMenuActor
                data-test-id="sidebar-switch-org"
                {...getActorProps()}
                onClick={e => {
                  // This overwrites `DropdownMenu.getActorProps.onClick` which normally handles clicks on actor
                  // to toggle visibility of menu. Instead, do nothing because it is nested and we only want it
                  // to appear when hovered on. Will also stop menu from closing when clicked on (which seems to be common
                  // behavior);

                  // Stop propagation so that dropdown menu doesn't close here
                  e.stopPropagation();
                }}
              >
                {t('Switch organization')}

                <SubMenuCaret>
                  <i className="icon-arrow-right" />
                </SubMenuCaret>
              </SwitchOrganizationMenuActor>

              {isOpen && (
                <SwitchOrganizationMenu
                  data-test-id="sidebar-switch-org-menu"
                  {...getMenuProps()}
                >
                  <OrganizationList>
                    {organizations.map(organization => {
                      const url = `/organizations/${organization.slug}/`;

                      return (
                        <SidebarMenuItem key={organization.slug} to={url}>
                          <SidebarOrgSummary organization={organization} />
                        </SidebarMenuItem>
                      );
                    })}
                  </OrganizationList>
                  {hasOrganizations && canCreateOrganization && (
                    <Divider css={{marginTop: 0}} />
                  )}
                  {canCreateOrganization && (
                    <SidebarMenuItem
                      data-test-id="sidebar-create-org"
                      to="/organizations/new/"
                      style={{alignItems: 'center'}}
                    >
                      <MenuItemLabelWithIcon>
                        <IconAdd circle />
                        &nbsp;{t('Create a new organization')}
                      </MenuItemLabelWithIcon>
                    </SidebarMenuItem>
                  )}
                </SwitchOrganizationMenu>
              )}
            </React.Fragment>
          );
        }}
      </DropdownMenu>
    );
  }
}
const SwitchOrganizationContainer = withOrganizations(SwitchOrganization);

export {SwitchOrganization};
export default SwitchOrganizationContainer;

const MenuItemLabelWithIcon = styled('span')`
  line-height: 1;
  display: flex;
  align-items: center;
  padding: 8px 0;
`;

const SubMenuCaret = styled('span')`
  color: ${p => p.theme.gray2};
  transition: 0.1s color linear;

  &:hover,
  &:active {
    color: ${p => p.theme.gray3};
  }
`;

// Menu Item in dropdown to "Switch organization"
const SwitchOrganizationMenuActor = styled('span')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 -${p => p.theme.sidebar.menuSpacing};
  padding: 0 ${p => p.theme.sidebar.menuSpacing};
`;

const SwitchOrganizationMenu = styled('div')`
  ${SidebarDropdownMenu};
  top: 0;
  left: 256px;
`;

const OrganizationList = styled('div')`
  max-height: 350px;
  overflow-y: auto;
`;
