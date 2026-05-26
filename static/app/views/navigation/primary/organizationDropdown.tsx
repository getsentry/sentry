import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {OrganizationAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {OrganizationBadge} from 'sentry/components/idBadge/organizationBadge';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

interface OrganizationDropdownProps {
  /**
   * When true, hides settings, projects, members, teams, and billing links for the current organization.
   */
  hideCurrentOrganizationLinks?: boolean;
  onClick?: () => void;
}

export function OrganizationDropdown(props: OrganizationDropdownProps) {
  const navigate = useNavigate();
  const config = useLegacyStore(ConfigStore);
  const theme = useTheme();
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  const organization = useOrganization();
  const {organizations} = useLegacyStore(OrganizationsStore);

  const [activeOrgs, inactiveOrgs] = partition(
    organizations.filter(org => org.slug !== organization.slug),
    org => org.status.id === 'active'
  );

  const {projects} = useProjects();
  const [, setReferrer] = useSessionStorage<string | null>(CUSTOM_REFERRER_KEY, null);

  const letterAvatarProps = {
    identifier: organization.slug,
    name: organization.name || organization.slug,
  };

  const size = useSizeContext();

  return (
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      trigger={triggerProps => (
        <AvatarButton
          avatar={
            organization.avatar.avatarType === 'upload' && organization.avatar.avatarUrl
              ? {
                  type: 'upload',
                  uploadUrl: organization.avatar.avatarUrl,
                  ...letterAvatarProps,
                }
              : organization.avatar.avatarType === 'gravatar' &&
                  organization.avatar.avatarUrl
                ? {
                    type: 'gravatar',
                    gravatarId: organization.avatar.avatarUrl,
                    ...letterAvatarProps,
                  }
                : {
                    type: 'letter_avatar',
                    ...letterAvatarProps,
                  }
          }
          size={size}
          aria-label={t('Toggle organization menu')}
          {...triggerProps}
          onClick={e => {
            triggerProps.onClick?.(e);
            props.onClick?.();
          }}
        />
      )}
      position="right-start"
      minMenuWidth={200}
      items={[
        {
          key: 'organization',
          textValue: organization.name,
          label: (
            <Flex align="center" gap="md">
              <OrganizationAvatar organization={organization} size={32} />
              <Stack gap="xs">
                <Text size="sm" bold uppercase variant="primary">
                  {organization.name}
                </Text>
                <Text size="xs" variant="muted">
                  {tn('%s Project', '%s Projects', projects.length)}
                </Text>
              </Stack>
            </Flex>
          ),
          children: [
            ...(props.hideCurrentOrganizationLinks
              ? []
              : [
                  {
                    key: 'organization-settings',
                    label: t('Organization Settings'),
                    to: `/settings/${organization.slug}/`,
                    hidden: !organization.access?.includes('org:read'),
                  },
                  {
                    key: 'projects',
                    label: t('Projects'),
                    onAction: () => {
                      setReferrer('org-dropdown');
                      navigate(makeProjectsPathname({path: '/', organization}));
                    },
                  },
                  {
                    key: 'members',
                    label: t('Members'),
                    to: `/settings/${organization.slug}/members/`,
                    hidden: !organization.access?.includes('member:read'),
                  },
                  {
                    key: 'teams',
                    label: t('Teams'),
                    to: `/settings/${organization.slug}/teams/`,
                    hidden: !organization.access?.includes('team:read'),
                  },
                  {
                    key: 'billing',
                    label: t('Usage & Billing'),
                    to: `/settings/${organization.slug}/billing/`,
                    hidden: !organization.access?.includes('org:billing'),
                  },
                ]),
            {
              key: 'switch-organization',
              label: t('Switch Organization'),
              isSubmenu: true,
              hidden: config.singleOrganization || isDemoModeActive(),
              children: [
                {
                  key: 'active-orgs',
                  children: orderBy(activeOrgs, ['name']).map(makeOrganizationMenuItem),
                  // Hide entire submenu if there are no active organizations
                  hidden: activeOrgs.length === 0,
                },
                {
                  key: 'inactive-ogs',
                  children: orderBy(inactiveOrgs, ['name']).map(
                    makeInactiveOrganizationMenuItem
                  ),
                  // Hide entire submenu if there are no inactive organizations
                  hidden: inactiveOrgs.length === 0,
                },
                makeCreateOrganizationMenuItem(),
              ],
            },
          ],
        },
      ]}
    />
  );
}

function makeOrganizationMenuItem(org: Organization): MenuItemProps {
  return {
    key: org.id,
    label: <OrganizationBadge organization={org} />,
    textValue: org.name,
    to: resolveRoute(`/organizations/${org.slug}/issues/`, null, org),
  };
}

function makeInactiveOrganizationMenuItem(org: Organization): MenuItemProps {
  return {
    ...makeOrganizationMenuItem(org),
    trailingItems: <QuestionTooltip size="sm" title={org.status.name} />,
  };
}

function makeCreateOrganizationMenuItem(): MenuItemProps {
  const configFeatures = ConfigStore.get('features');

  const menuItemProps: MenuItemProps = {
    key: 'create-organization',
    leadingItems: <IconAdd />,
    label: t('Create a new organization'),
  };

  if (configFeatures.has('system:multi-region')) {
    menuItemProps.externalHref =
      localizeDomain(ConfigStore.get('links').sentryUrl) + '/organizations/new/';
  } else {
    menuItemProps.to = '/organizations/new/';
  }

  return {
    key: 'create-organization-section',
    children: [menuItemProps],
    hidden: !ConfigStore.get('features').has('organizations:create'),
  };
}
