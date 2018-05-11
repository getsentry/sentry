import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/proptypes';
import withOrganizations from 'app/utils/withOrganizations';

import SidebarOrgSummary from './sidebarOrgSummary';
import SidebarMenuItem from './sidebarMenuItem';
import Divider from './divider.styled';
import SidebarDropdownMenu from './sidebarDropdownMenu.styled';

/**
 * Switch Organization Menu Label + Sub Menu
 */
class SwitchOrganization extends React.Component {
  static propTypes = {
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
    canCreateOrganization: PropTypes.bool,
  };

  render() {
    let {organizations, canCreateOrganization} = this.props;
    let hasOrganizations = organizations && !!organizations.length;

    return (
      <DropdownMenu isNestedDropdown>
        {({isOpen, getMenuProps, getActorProps}) => {
          return (
            <React.Fragment>
              <SwitchOrganizationMenuActor
                data-test-id="sidebar-switch-org"
                {...getActorProps({
                  isStyled: true,
                })}
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
                  {...getMenuProps({isStyled: true})}
                >
                  <OrganizationList>
                    {organizations.map(organization => (
                      <SidebarMenuItem
                        key={organization.slug}
                        to={`/${organization.slug}/`}
                      >
                        <SidebarOrgSummary organization={organization} />
                      </SidebarMenuItem>
                    ))}
                  </OrganizationList>
                  {hasOrganizations &&
                    canCreateOrganization && <Divider css={{marginTop: 0}} />}
                  {canCreateOrganization && (
                    <SidebarMenuItem
                      data-test-id="sidebar-create-org"
                      to={'/organizations/new/'}
                      style={{alignItems: 'center'}}
                    >
                      <MenuItemLabelWithIcon>
                        <AddIcon src="icon-circle-add" />
                        <span>{t('Create a new organization')}</span>
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

const AddIcon = styled(InlineSvg)`
  width: 15px;
  height: 15px;
  margin-right: 8px;
  color: ${p => p.theme.gray2};
`;

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
