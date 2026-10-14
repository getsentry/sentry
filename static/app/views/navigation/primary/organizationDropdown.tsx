import {useEffect, useRef, useState} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';
import {IconAdd} from '@sentry/icons/add';
import {IconBuilding} from '@sentry/icons/building';
import {IconSettings} from '@sentry/icons/settings';
import {IconStar} from '@sentry/icons/star';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {OrganizationAvatar, ProjectAvatar} from '@sentry/scraps/avatar';
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
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {darkTheme} from 'sentry/utils/theme/theme';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
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
  const [projectSearch, setProjectSearch] = useState('');
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
  const canCreateProject = useCanCreateProject();
  const {selection} = usePageFilters();
  const sortedProjects = sortBy(projects, project => [
    !selection.projects.includes(Number(project.id)),
    !project.isBookmarked,
    !project.isMember,
    project.slug,
  ]);
  const visibleProjects = sortedProjects.slice(0, 5);
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
    const matchingProjects = sortedProjects.filter(project =>
      project.slug.toLocaleLowerCase().includes(projectSearch.toLocaleLowerCase())
    );
    const allProjectItems: MenuItemProps[] = [
      {
        key: 'my-projects',
        label: t('My Projects'),
        children: matchingProjects
          .filter(project => project.isMember)
          .map(project => ({
            key: `all-project-${project.id}`,
            label: project.slug,
            leadingItems: <ProjectAvatar project={project} size={16} />,
            trailingItems: project.isBookmarked ? (
              <IconStar variant="warning" isSolid />
            ) : undefined,
            to: `/settings/${organization.slug}/projects/${project.slug}/`,
          })),
      },
      {
        key: 'other-projects',
        label: t('Other Projects'),
        children: matchingProjects
          .filter(project => !project.isMember)
          .map(project => ({
            key: `all-project-${project.id}`,
            label: project.slug,
            leadingItems: <ProjectAvatar project={project} size={16} />,
            trailingItems: project.isBookmarked ? (
              <IconStar variant="warning" isSolid />
            ) : undefined,
            to: `/settings/${organization.slug}/projects/${project.slug}/`,
          })),
      },
    ].filter(section => section.children?.length);
    if (allProjectItems.length === 0) {
      allProjectItems.push({
        key: 'no-projects',
        label: t('No projects found'),
        disabled: true,
      });
    }
    return (
      <DropdownMenu
        usePortal
        portalContainerRef={portalContainerRef}
        zIndex={theme.zIndex.modal}
        trigger={trigger}
        minMenuWidth={258}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setProjectSearch('');
          }
        }}
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
                hidden: config.singleOrganization || isDemoModeActive(),
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
          {
            key: 'project-settings',
            label: t('Project Settings'),
            hidden: props.hideCurrentOrganizationLinks,
            children: [
              ...visibleProjects.map(project => ({
                key: `project-${project.id}`,
                label: project.slug,
                leadingItems: <ProjectAvatar project={project} size={16} />,
                to: `/settings/${organization.slug}/projects/${project.slug}/`,
                trailingItems: project.isBookmarked ? (
                  <IconStar variant="warning" isSolid />
                ) : undefined,
              })),
              {
                key: 'view-all-projects',
                label: t('View All Projects'),
                leadingItems: <Container width="16px" height="16px" />,
                submenu: {
                  title: t('All Projects'),
                  maxHeight: 400,
                  items: allProjectItems,
                  search: {
                    value: projectSearch,
                    onChange: setProjectSearch,
                    placeholder: t('Search'),
                  },
                },
              },
              {
                key: 'create-project',
                label: t('Create Project'),
                leadingItems: <IconAdd />,
                to: makeProjectsPathname({path: '/new/', organization}),
                hidden: !canCreateProject,
              },
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
        background: linear-gradient(110deg, #2c155c, #4e168c);
      `}
    >
      <Stack gap="md" padding="md lg">
        <ThemeProvider theme={darkTheme}>
          <Text
            size="sm"
            density="fixed"
            tabular
            css={theme => css`
              color: ${theme.tokens.interactive.transparent.neutral.content.headings};
              font-weight: ${theme.font.weight.sans.medium};
            `}
          >
            {t('Organization')}
          </Text>
        </ThemeProvider>
        <Flex align="center" gap="md">
          <Flex
            align="center"
            justify="center"
            width="34px"
            height="34px"
            radius="md"
            overflow="hidden"
            border="muted"
            background="primary"
          >
            <OrganizationAvatar organization={organization} size={32} />
          </Flex>
          <ThemeProvider theme={darkTheme}>
            <Stack gap="0">
              <Text
                size="md"
                density="default"
                css={theme => css`
                  color: ${theme.tokens.content.headings};
                  font-weight: ${theme.font.weight.sans.medium};
                `}
              >
                {organization.name || organization.slug}
              </Text>
              <Text
                size="sm"
                density="comfortable"
                variant="secondary"
                bold={false}
                tabular
              >
                {tn('%s Project', '%s Projects', projectCount)}
              </Text>
            </Stack>
          </ThemeProvider>
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
