import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {logout} from 'sentry/actionCreators/account';
import {Button} from 'sentry/components/button';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {IconAdd, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {OrganizationSummary} from 'sentry/types/organization';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

function createOrganizationMenuItem(): MenuItemProps {
  const configFeatures = ConfigStore.get('features');
  const sentryUrl = localizeDomain(ConfigStore.get('links').sentryUrl);
  const route = '/organizations/new/';
  const canCreateOrg = ConfigStore.get('features').has('organizations:create');

  const menuItemProps: MenuItemProps = {
    key: 'create-organization',
    label: (
      <CreateOrganizationMenuItem>
        <IconAdd />
        {t('Create a new organization')}
      </CreateOrganizationMenuItem>
    ),
  };

  if (configFeatures.has('system:multi-region')) {
    menuItemProps.externalHref = sentryUrl + route;
  } else {
    menuItemProps.to = route;
  }

  return {
    key: 'create-organization-section',
    children: [menuItemProps],
    hidden: !canCreateOrg,
  };
}

function SwitchOrganizationItem({organization}: {organization: OrganizationSummary}) {
  return (
    <SwitchOrganizationWrapper>
      {organization.status.id === 'pending_deletion' ? (
        <PendingDeletionAvatar data-test-id="pending-deletion-icon">
          <IconWarning size="xs" color="gray200" />
        </PendingDeletionAvatar>
      ) : (
        <OrganizationAvatar organization={organization} size={22} />
      )}
      <SwitchOrganizationItemName
        pendingDeletion={organization.status.id === 'pending_deletion'}
      >
        {organization.name}
      </SwitchOrganizationItemName>
    </SwitchOrganizationWrapper>
  );
}

export function OrgDropdown() {
  const api = useApi();

  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const user = useUser();

  // It's possible we do not have an org in context (e.g. RouteNotFound)
  // Otherwise, we should have the full org
  const hasOrgRead = organization?.access?.includes('org:read');
  const hasMemberRead = organization?.access?.includes('member:read');
  const hasTeamRead = organization?.access?.includes('team:read');

  const {organizations} = useLegacyStore(OrganizationsStore);

  const {projects} = useProjects();

  function handleLogout() {
    logout(api);
  }

  return (
    <DropdownMenu
      trigger={props => (
        <OrgDropdownTrigger
          size="zero"
          borderless
          aria-label={t('Toggle organization menu')}
          {...props}
        >
          <StyledOrganizationAvatar size={32} round={false} organization={organization} />
        </OrgDropdownTrigger>
      )}
      minMenuWidth={200}
      items={[
        {
          key: 'organization',
          label: (
            <SectionTitleWrapper>
              <OrganizationBadge
                organization={organization}
                description={tn('%s Project', '%s Projects', projects.length)}
                avatarSize={32}
              />
            </SectionTitleWrapper>
          ),
          children: [
            {
              key: 'organization-settings',
              label: t('Organization Settings'),
              to: `/settings/${organization.slug}/`,
              hidden: !hasOrgRead,
            },
            {
              key: 'members',
              label: t('Members'),
              to: `/settings/${organization.slug}/members/`,
              hidden: !hasMemberRead,
            },
            {
              key: 'teams',
              label: t('Teams'),
              to: `/settings/${organization.slug}/teams/`,
              hidden: !hasTeamRead,
            },
            {
              key: 'switch-organization',
              label: t('Switch Organization'),
              isSubmenu: true,
              disabled: !organizations?.length,
              hidden: config.singleOrganization || isDemoModeEnabled(),
              children: [
                ...orderBy(organizations, ['status.id', 'name']).map(switchOrg => ({
                  key: switchOrg.id,
                  label: <SwitchOrganizationItem organization={switchOrg} />,
                  textValue: switchOrg.name,
                  to: resolveRoute(
                    `/organizations/${switchOrg.slug}/issues/`,
                    organization,
                    switchOrg
                  ),
                })),
                createOrganizationMenuItem(),
              ],
            },
          ],
        },
        {
          key: 'user',
          label: (
            <SectionTitleWrapper>
              <UserBadge user={user} avatarSize={32} />
            </SectionTitleWrapper>
          ),
          textValue: t('User Summary'),
          children: [
            {
              key: 'user-settings',
              label: t('User Settings'),
              to: '/settings/account/',
            },
            {
              key: 'user-auth-tokens',
              label: t('User Auth Tokens'),
              to: '/settings/account/api/',
            },
            {
              key: 'admin',
              label: t('Admin'),
              to: '/manage/',
              hidden: !user?.isSuperuser,
            },
            {
              key: 'signout',
              label: t('Sign Out'),
              onAction: handleLogout,
            },
          ],
        },
      ]}
    />
  );
}

const OrgDropdownTrigger = styled(Button)`
  height: 44px;
  width: 44px;
`;

const StyledOrganizationAvatar = styled(OrganizationAvatar)`
  border-radius: 6px; /* Fixes background bleeding on corners */
`;

const SwitchOrganizationWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  text-transform: none;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
`;

const SwitchOrganizationItemName = styled('div')<{pendingDeletion: boolean}>`
  color: ${p => (p.pendingDeletion ? p.theme.subText : p.theme.textColor)};
  line-height: normal;
  ${p => p.theme.overflowEllipsis};
`;

const PendingDeletionAvatar = styled('div')`
  height: 22px;
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed ${p => p.theme.gray200};
  border-radius: 4px;
`;

const CreateOrganizationMenuItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: normal;
`;
