import {Fragment} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {Client} from 'sentry/api';
import DemoModeGate from 'sentry/components/acl/demoModeGate';
import Avatar from 'sentry/components/avatar';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import Hook from 'sentry/components/hook';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import SidebarDropdownMenu from 'sentry/components/sidebar/sidebarDropdownMenu.styled';
import SidebarMenuItem, {menuItemStyles} from 'sentry/components/sidebar/sidebarMenuItem';
import SidebarOrgSummary from 'sentry/components/sidebar/sidebarOrgSummary';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Config, Organization, Project, User} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';

import SidebarMenuItemLink from '../sidebarMenuItemLink';
import {CommonSidebarProps} from '../types';

import Divider from './divider.styled';
import SwitchOrganization from './switchOrganization';

// TODO: make org and user optional props
type Props = Pick<CommonSidebarProps, 'orientation' | 'collapsed'> & {
  api: Client;
  config: Config;
  projects: Project[];
  user: User;
  /**
   * Set to true to hide links within the organization
   */
  hideOrgLinks?: boolean;
  org?: Organization;
};

const SidebarDropdown = ({
  api,
  org,
  projects,
  orientation,
  collapsed,
  config,
  user,
  hideOrgLinks,
}: Props) => {
  const handleLogout = async () => {
    await logout(api);
    window.location.assign('/auth/login/');
  };

  const hasOrganization = !!org;
  const hasUser = !!user;

  // It's possible we do not have an org in context (e.g. RouteNotFound)
  // Otherwise, we should have the full org
  const hasOrgRead = org?.access?.includes('org:read');
  const hasMemberRead = org?.access?.includes('member:read');
  const hasTeamRead = org?.access?.includes('team:read');
  const canCreateOrg = ConfigStore.get('features').has('organizations:create');

  // Avatar to use: Organization --> user --> Sentry
  const avatar =
    hasOrganization || hasUser ? (
      <StyledAvatar
        collapsed={collapsed}
        organization={org}
        user={!org ? user : undefined}
        size={32}
        round={false}
      />
    ) : (
      <SentryLink to="/">
        <IconSentry size="xl" />
      </SentryLink>
    );

  return (
    <DeprecatedDropdownMenu>
      {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
        <SidebarDropdownRoot {...getRootProps()}>
          <SidebarDropdownActor
            type="button"
            data-test-id="sidebar-dropdown"
            {...getActorProps({})}
          >
            {avatar}
            {!collapsed && orientation !== 'top' && (
              <OrgAndUserWrapper>
                <OrgOrUserName>
                  {hasOrganization ? org.name : user.name}{' '}
                  <StyledIconChevron color="white" size="xs" direction="down" />
                </OrgOrUserName>
                <UserNameOrEmail>
                  {hasOrganization ? user.name : user.email}
                </UserNameOrEmail>
              </OrgAndUserWrapper>
            )}
          </SidebarDropdownActor>

          {isOpen && (
            <OrgAndUserMenu {...getMenuProps({})}>
              {hasOrganization && (
                <Fragment>
                  <SidebarOrgSummary organization={org} projectCount={projects.length} />
                  {!hideOrgLinks && (
                    <Fragment>
                      {hasOrgRead && (
                        <SidebarMenuItem to={`/settings/${org.slug}/`}>
                          {t('Organization settings')}
                        </SidebarMenuItem>
                      )}
                      {hasMemberRead && (
                        <SidebarMenuItem to={`/settings/${org.slug}/members/`}>
                          {t('Members')}
                        </SidebarMenuItem>
                      )}

                      {hasTeamRead && (
                        <SidebarMenuItem to={`/settings/${org.slug}/teams/`}>
                          {t('Teams')}
                        </SidebarMenuItem>
                      )}

                      <Hook
                        name="sidebar:organization-dropdown-menu"
                        organization={org}
                      />
                    </Fragment>
                  )}

                  {!config.singleOrganization && (
                    <DemoModeGate>
                      <SidebarMenuItem>
                        <SwitchOrganization canCreateOrganization={canCreateOrg} />
                      </SidebarMenuItem>
                    </DemoModeGate>
                  )}
                </Fragment>
              )}

              <DemoModeGate>
                {hasOrganization && user && <Divider />}
                {!!user && (
                  <Fragment>
                    <UserSummary to="/settings/account/details/">
                      <UserBadgeNoOverflow user={user} avatarSize={32} />
                    </UserSummary>

                    <div>
                      <SidebarMenuItem to="/settings/account/">
                        {t('User settings')}
                      </SidebarMenuItem>
                      <SidebarMenuItem to="/settings/account/api/">
                        {t('API keys')}
                      </SidebarMenuItem>
                      {hasOrganization && (
                        <Hook
                          name="sidebar:organization-dropdown-menu-bottom"
                          organization={org}
                        />
                      )}
                      {user.isSuperuser && (
                        <SidebarMenuItem to="/manage/">{t('Admin')}</SidebarMenuItem>
                      )}
                      <SidebarMenuItem
                        data-test-id="sidebar-signout"
                        onClick={handleLogout}
                      >
                        {t('Sign out')}
                      </SidebarMenuItem>
                    </div>
                  </Fragment>
                )}
              </DemoModeGate>
            </OrgAndUserMenu>
          )}
        </SidebarDropdownRoot>
      )}
    </DeprecatedDropdownMenu>
  );
};

export default withApi(withProjects(SidebarDropdown));

const SentryLink = styled(Link)`
  color: ${p => p.theme.white};
  &:hover {
    color: ${p => p.theme.white};
  }
`;

const UserSummary = styled(Link)<
  Omit<React.ComponentProps<typeof SidebarMenuItemLink>, 'children'>
>`
  ${p => menuItemStyles(p)}
  padding: 10px 15px;
`;

const UserBadgeNoOverflow = styled(IdBadge)`
  overflow: hidden;
`;

const SidebarDropdownRoot = styled('div')`
  position: relative;
`;

// So that long org names and user names do not overflow
const OrgAndUserWrapper = styled('div')`
  overflow-x: hidden;
  text-align: left;
`;
const OrgOrUserName = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.2;
  font-weight: bold;
  color: ${p => p.theme.white};
  text-shadow: 0 0 6px rgba(255, 255, 255, 0);
  transition: 0.15s text-shadow linear;
`;

const UserNameOrEmail = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 16px;
  transition: 0.15s color linear;
`;

const SidebarDropdownActor = styled('button')`
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  border: none;
  padding: 0;
  background: none;
  width: 100%;

  &:hover {
    ${OrgOrUserName} {
      text-shadow: 0 0 6px rgba(255, 255, 255, 0.1);
    }
    ${UserNameOrEmail} {
      color: ${p => p.theme.white};
    }
  }
`;

const StyledAvatar = styled(Avatar)<{collapsed: boolean}>`
  margin: ${space(0.25)} 0;
  margin-right: ${p => (p.collapsed ? '0' : space(1.5))};
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.08);
  border-radius: 6px; /* Fixes background bleeding on corners */
`;

const OrgAndUserMenu = styled('div')`
  ${SidebarDropdownMenu};
  top: 42px;
  min-width: 180px;
  z-index: ${p => p.theme.zIndex.orgAndUserMenu};
`;

const StyledIconChevron = styled(IconChevron)`
  margin-left: ${space(0.25)};
`;
