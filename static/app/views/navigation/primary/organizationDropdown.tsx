import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import {IconAdd} from '@sentry/icons/add';
import {IconBuilding} from '@sentry/icons/building';
import {IconSettings} from '@sentry/icons/settings';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {
  getOrganizationAvatarProps,
  OrganizationAvatar,
  ProjectAvatar,
} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from '@sentry/scraps/dropdownMenu';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {OrganizationBadge} from 'sentry/components/idBadge/organizationBadge';
import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useNavigate, type ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {NavigationMenuHeader} from './navigationMenuHeader';

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
  const canCreateProject = useCanCreateProject();
  const [, setReferrer] = useSessionStorage<string | null>(CUSTOM_REFERRER_KEY, null);

  const avatarProps = getOrganizationAvatarProps(organization);

  const size = useSizeContext();

  const trigger: DropdownMenuProps['trigger'] = triggerProps => (
    <AvatarButton
      avatar={avatarProps}
      size={size}
      aria-label={t('Toggle organization menu')}
      {...triggerProps}
    />
  );
  const createOrganizationItem = makeCreateOrganizationMenuItem();
  const memberProjects = sortProjects(projects.filter(project => project.isMember));
  const otherProjects = sortProjects(projects.filter(project => !project.isMember));

  if (settingsV3) {
    return (
      <DropdownMenu
        usePortal
        portalContainerRef={portalContainerRef}
        zIndex={theme.zIndex.modal}
        trigger={trigger}
        minMenuWidth={258}
        menuWidth={258}
        menuTitle={
          <NavigationMenuHeader
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
          {
            key: 'project-settings',
            label: t('Project Settings'),
            hidden: props.hideCurrentOrganizationLinks,
            children: [
              ...projects
                .filter(project => project.isBookmarked)
                .slice(0, 5)
                .map(project =>
                  makeProjectMenuItem(project, organization, navigate, 'starred-project')
                ),
              {
                key: 'view-all-projects',
                label: t('View All Projects'),
                leadingItems: <span aria-hidden="true" />,
                submenu: {
                  title: t('All Projects'),
                  emptyMessage: t('No projects found'),
                  search: {placeholder: t('Search'), showIcon: false, size: 'sm'},
                  maxMenuHeight: 240,
                  minMenuHeight: 240,
                  menuWidth: 258,
                },
                hidden: projects.length === 0,
                children: [
                  {
                    key: 'my-projects',
                    label: t('My Projects'),
                    hidden: memberProjects.length === 0,
                    children: memberProjects.map(project =>
                      makeProjectMenuItem(project, organization, navigate)
                    ),
                  },
                  {
                    key: 'other-projects',
                    label: t('Other Projects'),
                    hidden: otherProjects.length === 0,
                    children: otherProjects.map(project =>
                      makeProjectMenuItem(project, organization, navigate)
                    ),
                  },
                ],
              },
              {
                key: 'create-project',
                label: t('Create Project'),
                leadingItems: <IconAdd />,
                to: makeProjectsPathname({path: '/new/', organization}),
                disabled: !canCreateProject,
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

function makeProjectMenuItem(
  project: Project,
  organization: Organization,
  navigate: ReactRouter3Navigate,
  keyPrefix = 'project'
): MenuItemProps {
  return {
    key: `${keyPrefix}-${project.id}`,
    label: project.slug,
    leadingItems: <ProjectAvatar project={project} size={16} />,
    trailingItems: (
      <BookmarkStar
        project={project}
        organization={organization}
        onClick={event => event.stopPropagation()}
      />
    ),
    onAction: () => navigate(`/settings/${organization.slug}/projects/${project.slug}/`),
  };
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
