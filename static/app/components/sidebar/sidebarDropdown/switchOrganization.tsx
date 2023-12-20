import {Fragment} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import SidebarDropdownMenu from 'sentry/components/sidebar/sidebarDropdownMenu.styled';
import SidebarMenuItem from 'sentry/components/sidebar/sidebarMenuItem';
import SidebarOrgSummary from 'sentry/components/sidebar/sidebarOrgSummary';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganizations from 'sentry/utils/withOrganizations';

import Divider from './divider.styled';

function OrganizationMenuItem({organization}: {organization: OrganizationSummary}) {
  const menuItemProps: Partial<React.ComponentProps<typeof SidebarMenuItem>> = {};
  // Allow null as we could be in an org-less User account view.
  const currentOrganization = useOrganization({allowNull: true});

  const route = resolveRoute(
    `/organizations/${organization.slug}/issues/`,
    currentOrganization,
    organization
  );

  // While a router only transition works when we're in an org
  // from org-less views (account settings) we need a page load.
  // We also need a page load when switching customer domains.
  menuItemProps.href = route;
  menuItemProps.openInNewTab = false;

  return (
    <SidebarMenuItem {...menuItemProps}>
      <SidebarOrgSummary organization={organization} />
    </SidebarMenuItem>
  );
}

function CreateOrganization({canCreateOrganization}: {canCreateOrganization: boolean}) {
  const currentOrganization = useOrganization({allowNull: true});
  if (!canCreateOrganization) {
    return null;
  }
  const sentryUrl = localizeDomain(ConfigStore.get('links').sentryUrl);
  const route = '/organizations/new/';
  const menuItemProps: Partial<React.ComponentProps<typeof SidebarMenuItem>> = {};

  if (currentOrganization?.features.includes('customer-domains')) {
    menuItemProps.href = sentryUrl + route;
    menuItemProps.openInNewTab = false;
  } else {
    menuItemProps.to = route;
  }

  return (
    <SidebarMenuItem
      data-test-id="sidebar-create-org"
      style={{alignItems: 'center'}}
      {...menuItemProps}
    >
      <MenuItemLabelWithIcon>
        <StyledIconAdd />
        <span>{t('Create a new organization')}</span>
      </MenuItemLabelWithIcon>
    </SidebarMenuItem>
  );
}

type Props = {
  canCreateOrganization: boolean;
  organizations: OrganizationSummary[];
};

/**
 * Switch Organization Menu Label + Sub Menu
 */
function SwitchOrganization({organizations, canCreateOrganization}: Props) {
  return (
    <DeprecatedDropdownMenu isNestedDropdown>
      {({isOpen, getMenuProps, getActorProps}) => (
        <Fragment>
          <SwitchOrganizationMenuActor
            data-test-id="sidebar-switch-org"
            {...getActorProps({})}
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
              <IconChevron size="xs" direction="right" />
            </SubMenuCaret>
          </SwitchOrganizationMenuActor>

          {isOpen && (
            <SwitchOrganizationMenu
              data-test-id="sidebar-switch-org-menu"
              {...getMenuProps({})}
            >
              <OrganizationList role="list">
                {sortBy(organizations, ['status.id']).map(organization => {
                  return (
                    <OrganizationMenuItem
                      key={organization.slug}
                      organization={organization}
                    />
                  );
                })}
              </OrganizationList>
              {organizations && !!organizations.length && canCreateOrganization && (
                <Divider css={{marginTop: 0}} />
              )}
              <CreateOrganization canCreateOrganization={canCreateOrganization} />
            </SwitchOrganizationMenu>
          )}
        </Fragment>
      )}
    </DeprecatedDropdownMenu>
  );
}

const SwitchOrganizationContainer = withOrganizations(SwitchOrganization);

export {SwitchOrganization};
export default SwitchOrganizationContainer;

const StyledIconAdd = styled(IconAdd)`
  margin-right: ${space(1)};
  color: ${p => p.theme.gray300};
`;

const MenuItemLabelWithIcon = styled('span')`
  line-height: 1;
  display: flex;
  align-items: center;
  padding: ${space(1)} 0;
`;

const SubMenuCaret = styled('span')`
  color: ${p => p.theme.gray300};
  transition: 0.1s color linear;

  &:hover,
  &:active {
    color: ${p => p.theme.subText};
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
