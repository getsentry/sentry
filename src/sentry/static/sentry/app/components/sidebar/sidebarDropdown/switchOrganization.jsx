import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/proptypes';
import withOrganizations from 'app/utils/withOrganizations';

import SidebarOrgSummary, {OrgSummary} from './sidebarOrgSummary';
import SidebarMenuItem, {MenuItemLink} from './sidebarMenuItem';
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
        {({
          isOpen,
          getMenuProps: getParentMenuProps,
          getActorProps: getParentActorProps,
        }) => {
          return (
            <DropdownAutoCompleteMenu
              {...getParentMenuProps({
                isOpen,
                emptyMessage: t('No organizations'),
                maxHeight: '350px',
                menuProps: {isStyled: true},
                inputProps: {style: {lineHeight: 1}},
                rootProps: {style: {width: '100%'}},
                items: organizations.map(organization => ({
                  value: organization.slug,
                  label: (
                    <SidebarMenuItem
                      key={organization.slug}
                      to={`/${organization.slug}/`}
                    >
                      <SidebarOrgSummary organization={organization} />
                    </SidebarMenuItem>
                  ),
                })),
                renderMenu: props => {
                  return (
                    <SwitchOrganizationMenu
                      data-test-id="sidebar-switch-org-menu"
                      {...props}
                      {...getParentMenuProps({isStyled: true})}
                    >
                      <OrganizationList>{props.children}</OrganizationList>
                      {hasOrganizations && canCreateOrganization && <Divider />}
                      {canCreateOrganization && (
                        <SidebarMenuItem
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
                  );
                },
              })}
            >
              {({getActorProps, actions, selectedItem}) => {
                return (
                  <SwitchOrganizationMenuActor
                    data-test-id="sidebar-switch-org"
                    {...getParentActorProps({isStyled: true})}
                  >
                    {t('Switch organization')}

                    <SubMenuCaret>
                      <i className="icon-arrow-right" />
                    </SubMenuCaret>
                  </SwitchOrganizationMenuActor>
                );
              }}
            </DropdownAutoCompleteMenu>
          );
        }}
      </DropdownMenu>
    );
  }
}
const SwitchOrganizationContainer = withOrganizations(SwitchOrganization);

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

// This is empty but is used below as a selector
const OrganizationList = styled('div')``;

const SwitchOrganizationMenu = styled('div')`
  ${SidebarDropdownMenu};
  top: 0;
  left: 240px;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${OrganizationList} {
    /* stylelint-disable-next-line no-duplicate-selectors */
    ${MenuItemLink} {
      padding: 0;
    }
  }

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${OrgSummary} {
    padding: 0;
  }
`;
