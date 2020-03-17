import React from 'react';
import styled from '@emotion/styled';

import {logout} from 'app/actionCreators/account';
import {t} from 'app/locale';
import Avatar from 'app/components/avatar';
import ConfigStore from 'app/stores/configStore';
import DropdownMenu from 'app/components/dropdownMenu';
import Hook from 'app/components/hook';
import IdBadge from 'app/components/idBadge';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import SidebarDropdownMenu from 'app/components/sidebar/sidebarDropdownMenu.styled';
import SidebarMenuItem, {menuItemStyles} from 'app/components/sidebar/sidebarMenuItem';
import SidebarOrgSummary from 'app/components/sidebar/sidebarOrgSummary';
import TextOverflow from 'app/components/textOverflow';
import withApi from 'app/utils/withApi';
import {Organization, User, Config} from 'app/types';
import {Client} from 'app/api';
import {SidebarOrientation} from 'app/components/sidebar/types';
import space from 'app/styles/space';

import SwitchOrganization from './switchOrganization';
import Divider from './divider.styled';

type Props = {
  api: Client;
  orientation: SidebarOrientation;
  collapsed: boolean;
  org: Organization;
  user: User;
  config: Config;
};

const SidebarDropdown = ({api, org, orientation, collapsed, config, user}: Props) => {
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
        <InlineSvg css={{fontSize: 32}} src="icon-sentry" />
      </SentryLink>
    );

  return (
    <DropdownMenu>
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
                  <i className="icon-arrow-down" />
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
                <React.Fragment>
                  <SidebarOrgSummary organization={org} />
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

                  <Hook name="sidebar:organization-dropdown-menu" organization={org} />

                  {!config.singleOrganization && (
                    <SidebarMenuItem>
                      <SwitchOrganization canCreateOrganization={canCreateOrg} />
                    </SidebarMenuItem>
                  )}

                  <Divider />
                </React.Fragment>
              )}

              {!!user && (
                <React.Fragment>
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
                    {user.isSuperuser && (
                      <SidebarMenuItem to="/manage/">{t('Admin')}</SidebarMenuItem>
                    )}
                    <SidebarMenuItem data-test-id="sidebarSignout" onClick={handleLogout}>
                      {t('Sign out')}
                    </SidebarMenuItem>
                  </div>
                </React.Fragment>
              )}
            </OrgAndUserMenu>
          )}
        </SidebarDropdownRoot>
      )}
    </DropdownMenu>
  );
};

export default withApi(SidebarDropdown);

const SentryLink = styled(Link)`
  color: ${p => p.theme.white};
  &:hover {
    color: ${p => p.theme.white};
  }
`;

const UserSummary = styled(Link)`
  ${menuItemStyles}
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
  overflow: hidden;
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
      color: ${p => p.theme.gray1};
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
