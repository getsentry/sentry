import {useEffect, useRef} from 'react';
import {css, useTheme} from '@emotion/react';
import {IconAdd} from '@sentry/icons/add';
import {IconBuilding} from '@sentry/icons/building';
import {IconSettings} from '@sentry/icons/settings';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {OrganizationAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from '@sentry/scraps/dropdownMenu';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {OrganizationBadge} from 'sentry/components/idBadge/organizationBadge';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

interface OrganizationDropdownProps {
  /**
   * When true, hides settings, projects, members, teams, and billing links for the current organization.
   */
  hideCurrentOrganizationLinks?: boolean;
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
  const settingsV3 = useSettingsV3();
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

  const trigger: DropdownMenuProps['trigger'] = triggerProps => (
    <AvatarButton
      avatar={
        organization.avatar.avatarType === 'upload' && organization.avatar.avatarUrl
          ? {
              type: 'upload',
              uploadUrl: organization.avatar.avatarUrl,
              ...letterAvatarProps,
            }
          : organization.avatar.avatarType === 'gravatar' && organization.avatar.avatarUrl
            ? {
                type: 'gravatar',
                gravatarId: organization.avatar.avatarUrl,
                ...letterAvatarProps,
              }
            : {type: 'letter_avatar', ...letterAvatarProps}
      }
      size={size}
      aria-label={t('Toggle organization menu')}
      {...triggerProps}
    />
  );
  const createOrganizationItem = makeCreateOrganizationMenuItem();

  if (settingsV3) {
    return (
      <DropdownMenu
        usePortal
        portalContainerRef={portalContainerRef}
        zIndex={theme.zIndex.modal}
        trigger={trigger}
        position="right-start"
        minMenuWidth={258}
        menuTitle={
          <OrganizationMenuHeader
            organization={organization}
            projectCount={projects.length}
          />
        }
        items={[
          {
            key: 'organization',
            textValue: organization.name,
            children: [
              {
                key: 'settings',
                label: t('Settings'),
                leadingItems: <IconSettings />,
                to: `/settings/${organization.slug}/`,
                hidden:
                  props.hideCurrentOrganizationLinks ||
                  !organization.access?.includes('org:read'),
              },
              {
                key: 'switch-organization',
                label: t('Switch'),
                leadingItems: <IconBuilding />,
                submenu: true,
                hidden:
                  config.singleOrganization ||
                  isDemoModeActive() ||
                  (activeOrgs.length === 0 && inactiveOrgs.length === 0),
                children: [
                  {
                    key: 'active-orgs',
                    children: orderBy(activeOrgs, ['name']).map(makeOrganizationMenuItem),
                    hidden: activeOrgs.length === 0,
                  },
                  {
                    key: 'inactive-orgs',
                    children: orderBy(inactiveOrgs, ['name']).map(
                      makeInactiveOrganizationMenuItem
                    ),
                    hidden: inactiveOrgs.length === 0,
                  },
                ],
              },
              createOrganizationItem,
            ],
          },
        ]}
      />
    );
  }

  return (
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      trigger={trigger}
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
              submenu: true,
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
                {
                  key: 'create-organization-section',
                  children: [
                    {...createOrganizationItem, label: t('Create a new organization')},
                  ],
                  hidden: createOrganizationItem.hidden,
                },
              ],
            },
          ],
        },
      ]}
    />
  );
}

function OrganizationMenuHeader({
  organization,
  projectCount,
}: {
  organization: OrganizationSummary;
  projectCount: number;
}) {
  return (
    <Container
      radius="md md 0 0"
      padding="xs"
      css={theme => css`
        /* Extend the header background through the menu title's padding. */
        margin: -${theme.space.sm} -${theme.space.lg};
        background: linear-gradient(90deg, #2c155c, #4e168c);
      `}
    >
      <Stack gap="md" padding="md lg">
        <Text
          size="sm"
          density="fixed"
          variant="inherit"
          tabular
          css={theme => css`
            color: ${darkTheme.tokens.interactive.transparent.neutral.content.headings};
            font-weight: ${theme.font.weight.sans.medium};
          `}
        >
          {t('Organization')}
        </Text>
        <Flex align="center" gap="md">
          <Flex
            align="center"
            justify="center"
            width="32px"
            height="32px"
            radius="md"
            overflow="hidden"
            css={css`
              background-color: ${lightTheme.tokens.background.primary};
              border: 1px solid ${darkTheme.tokens.border.transparent.neutral.muted};
            `}
          >
            <OrganizationAvatar organization={organization} size={30} />
          </Flex>
          <Stack gap="0">
            <Text
              size="md"
              density="comfortable"
              variant="inherit"
              css={theme => css`
                color: ${darkTheme.tokens.content.headings};
                font-weight: ${theme.font.weight.sans.medium};
              `}
            >
              {organization.name || organization.slug}
            </Text>
            <Text
              size="sm"
              density="comfortable"
              variant="inherit"
              tabular
              css={css`
                color: ${darkTheme.tokens.content.secondary};
              `}
            >
              {tn('%s Project', '%s Projects', projectCount)}
            </Text>
          </Stack>
        </Flex>
      </Stack>
    </Container>
  );
}

function makeOrganizationMenuItem(org: OrganizationSummary): MenuItemProps {
  return {
    key: org.id,
    label: <OrganizationBadge organization={org} />,
    textValue: org.name,
    to: resolveRoute(`/organizations/${org.slug}/issues/`, null, org),
  };
}

function makeInactiveOrganizationMenuItem(org: OrganizationSummary): MenuItemProps {
  return {
    ...makeOrganizationMenuItem(org),
    trailingItems: <InfoTip size="sm" title={org.status.name} />,
  };
}

function makeCreateOrganizationMenuItem(): MenuItemProps {
  const configFeatures = ConfigStore.get('features');

  const menuItemProps: MenuItemProps = {
    key: 'create-organization',
    leadingItems: <IconAdd />,
    label: t('Create Organization'),
    hidden: !configFeatures.has('organizations:create'),
  };

  if (configFeatures.has('system:multi-region')) {
    menuItemProps.externalHref =
      localizeDomain(ConfigStore.get('links').sentryUrl) + '/organizations/new/';
  } else {
    menuItemProps.to = '/organizations/new/';
  }

  return menuItemProps;
}
