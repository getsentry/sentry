import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Avatar from 'app/components/avatar';
import DropdownMenu from 'app/components/dropdownMenu';
import Hook from 'app/components/hook';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import SentryTypes from 'app/proptypes';
import TextOverflow from 'app/components/textOverflow';
import IdBadge from 'app/components/idBadge';

import SwitchOrganization from './switchOrganization';
import SidebarOrgSummary from './sidebarOrgSummary';
import SidebarMenuItem from './sidebarMenuItem';
import Divider from './divider.styled';
import SidebarDropdownMenu from './sidebarDropdownMenu.styled';

class SidebarDropdown extends React.Component {
  static propTypes = {
    orientation: PropTypes.oneOf(['top', 'left']),
    collapsed: PropTypes.bool,
    org: SentryTypes.Organization,
    user: SentryTypes.User,
    config: SentryTypes.Config,
    onClick: PropTypes.func,
  };

  static defaultProps = {
    onClick: () => {},
  };

  render() {
    let {org, orientation, collapsed, config, user, onClick} = this.props;
    let hasOrganization = !!org;
    let hasUser = !!user;

    // If there is no org in context, we use an org from `withLatestContext`
    // (which uses an org from organizations index endpoint versus details endpoint)
    // and does not have `access`
    let hasOrgRead = org && org.access && org.access.indexOf('org:read') > -1;
    let hasOrgWrite = org && org.access && org.access.indexOf('org:write') > -1;
    let hasMemberRead = org && org.access && org.access.indexOf('member:read') > -1;
    let hasTeamRead = org && org.access && org.access.indexOf('team:read') > -1;

    // Avatar to use: Organization --> user --> Sentry
    const avatar =
      hasOrganization || hasUser ? (
        <StyledAvatar
          onClick={onClick}
          collapsed={collapsed}
          organization={org}
          user={!org ? user : null}
          size={32}
        />
      ) : (
        <SentryLink to="/">
          <InlineSvg css={{fontSize: 32}} src="icon-sentry" />
        </SentryLink>
      );

    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          return (
            <SidebarDropdownRoot {...getRootProps({isStyled: true})}>
              <SidebarDropdownActor
                data-test-id="sidebar-dropdown"
                {...getActorProps({isStyled: true})}
              >
                <div style={{display: 'flex', alignItems: 'flex-start'}}>
                  {avatar}
                  {hasOrganization &&
                    !collapsed &&
                    orientation !== 'top' && (
                      <NameAndOrgWrapper>
                        <DropdownOrgName>
                          {org.name} <i className="icon-arrow-down" />
                        </DropdownOrgName>
                        <DropdownUserName>{user.name}</DropdownUserName>
                      </NameAndOrgWrapper>
                    )}
                </div>
              </SidebarDropdownActor>

              {isOpen && (
                <OrgAndUserMenu {...getMenuProps({isStyled: true, org})}>
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

                      <Hook
                        name="sidebar:organization-dropdown-menu"
                        organization={org}
                        Components={{SidebarMenuItem}}
                      />

                      {config.isOnPremise && (
                        <SidebarMenuItem href="https://forum.sentry.io/">
                          {t('Support forum')}
                        </SidebarMenuItem>
                      )}

                      <SidebarMenuItem>
                        <SwitchOrganization canCreateOrganization={hasOrgWrite} />
                      </SidebarMenuItem>

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
                        <SidebarMenuItem to={'/settings/account/api/'}>
                          {t('API keys')}
                        </SidebarMenuItem>
                        {user.isSuperuser && (
                          <SidebarMenuItem to={'/manage/'}>{t('Admin')}</SidebarMenuItem>
                        )}
                        <SidebarMenuItem href="/auth/logout/">
                          {t('Sign out')}
                        </SidebarMenuItem>
                      </div>
                    </React.Fragment>
                  )}
                </OrgAndUserMenu>
              )}
            </SidebarDropdownRoot>
          );
        }}
      </DropdownMenu>
    );
  }
}

export default SidebarDropdown;

const SentryLink = styled(Link)`
  color: ${p => p.theme.white};
  &:hover {
    color: ${p => p.theme.white};
  }
`;

const UserSummary = styled(Link)`
  display: flex;
  padding: 10px 15px;
`;

const UserBadgeNoOverflow = styled(IdBadge)`
  overflow: hidden;
`;

const SidebarDropdownRoot = styled('div')`
  position: relative;
`;

// So that long org names and user names do not overflow
const NameAndOrgWrapper = styled('div')`
  overflow: hidden;
`;
const DropdownOrgName = styled(TextOverflow)`
  font-size: 16px;
  line-height: 1.2;
  font-weight: bold;
  color: ${p => p.theme.white};
  text-shadow: 0 0 6px rgba(255, 255, 255, 0);
  transition: 0.15s text-shadow linear;
`;

const DropdownUserName = styled(TextOverflow)`
  font-size: 14px;
  line-height: 16px;
  transition: 0.15s color linear;
`;

const SidebarDropdownActor = styled('div')`
  cursor: pointer;

  &:hover {
    /* stylelint-disable-next-line no-duplicate-selectors */
    ${DropdownOrgName} {
      text-shadow: 0 0 6px rgba(255, 255, 255, 0.1);
    }
    /* stylelint-disable-next-line no-duplicate-selectors */
    ${DropdownUserName} {
      color: ${p => p.theme.gray1};
    }
  }
`;

const StyledAvatar = styled(Avatar)`
  margin-top: 2px;
  margin-bottom: 2px;
  margin-right: ${p => (p.collapsed ? '0' : '12px')};
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.08);
  border-radius: 4px;
`;

const OrgAndUserMenu = styled('div')`
  ${SidebarDropdownMenu};
  top: 42px;
  min-width: 180px;
`;
