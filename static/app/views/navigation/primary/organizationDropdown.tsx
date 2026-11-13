import {useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {IconAdd} from '@sentry/icons/add';
import {IconBuilding} from '@sentry/icons/building';
import {IconSettings} from '@sentry/icons/settings';
import omit from 'lodash/omit';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';
import {useStore} from 'zustand';

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
import type {MenuItemTrailingAction} from '@sentry/scraps/menu';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {OrganizationBadge} from 'sentry/components/idBadge/organizationBadge';
import {BookmarkStarIcon} from 'sentry/components/projects/bookmarkStar';
import {useUpdateProjectBookmark} from 'sentry/components/projects/useUpdateProjectBookmark';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {sortProjectsByBookmarkAndMembership} from 'sentry/utils/project/sortProjects';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {
  SettingsNavigationTourElement,
  useSettingsNavigationTour,
} from 'sentry/views/navigation/settingsNavigationTour';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {getSettingsScopeTitle} from 'sentry/views/settings/settingsScope';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {NavigationMenuHeader} from './navigationMenuHeader';

const QUICK_ACCESS_PROJECT_LIMIT = 5;

type OrgMenuProjectSource = 'quick_access' | 'all_projects';

interface OrganizationDropdownProps {
  /**
   * When true, hides the links into the current organization. Without
   * settings-v3, these are settings, projects, members, teams, and billing.
   * With settings-v3, these are settings and project settings.
   */
  hideCurrentOrganizationLinks?: boolean;
}

export function OrganizationDropdown(props: OrganizationDropdownProps) {
  const navigate = useNavigate();
  const singleOrganization = useStore(ConfigStore, state => state.singleOrganization);
  const theme = useTheme();
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  const organization = useOrganization();
  const settingsV3 = useSettingsV3();
  const settingsTour = useSettingsNavigationTour();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const isProjectTourActive = settingsTour?.currentStepId === 'projects';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const organizations = useStore(OrganizationsStore, state => state.organizations);

  const [activeOrgs, inactiveOrgs] = partition(
    organizations.filter(org => org.slug !== organization.slug),
    org => org.status.id === 'active'
  );

  const {projects, initiallyLoaded} = useProjects();
  const hasNoProjects = initiallyLoaded && projects.length === 0;
  const canCreateProject = useCanCreateProject();
  const [, setReferrer] = useSessionStorage<string | null>(CUSTOM_REFERRER_KEY, null);

  // Bookmark state for in-flight toggles, keyed by project ID. Cleared once the
  // request settles: on success ProjectsStore has the new value, on error the
  // project falls back to its previous state.
  const [pendingBookmarks, setPendingBookmarks] = useState<Record<string, boolean>>({});
  // Captured when the menu opens, so toggling a bookmark does not reorder the
  // open menu.
  const [bookmarkedSnapshot, setBookmarkedSnapshot] = useState<Set<string>>();
  const {mutate: toggleBookmark} = useUpdateProjectBookmark({
    organization,
    onMutate: ({project, isBookmarked}) => {
      setPendingBookmarks(prev => ({...prev, [project.id]: isBookmarked}));
    },
    onSettled: ({project}) => {
      setPendingBookmarks(prev => omit(prev, project.id));
    },
  });

  const makeBookmarkAction = (
    project: Project,
    source: OrgMenuProjectSource
  ): MenuItemTrailingAction => {
    const isBookmarked = pendingBookmarks[project.id] ?? project.isBookmarked;
    return {
      icon: <BookmarkStarIcon isBookmarked={isBookmarked} />,
      label: isBookmarked ? t('Remove Bookmark') : t('Bookmark'),
      busy: project.id in pendingBookmarks,
      onAction: () => {
        trackAnalytics('settings.org_menu.project_bookmark_toggled', {
          organization,
          bookmarked: !isBookmarked,
          source,
        });
        toggleBookmark({project, isBookmarked: !isBookmarked});
      },
    };
  };

  const makeSettingsProjectMenuItem = (
    project: Project,
    source: OrgMenuProjectSource
  ): MenuItemProps => ({
    ...makeProjectMenuItem(
      project,
      organization,
      makeBookmarkAction(project, source),
      source === 'quick_access' ? 'quick-access-project' : 'project'
    ),
    onAction: () =>
      trackAnalytics('settings.org_menu.project_clicked', {organization, source}),
  });

  const avatarProps = getOrganizationAvatarProps(organization);

  const size = useSizeContext();

  const trigger: DropdownMenuProps['trigger'] = triggerProps => (
    <SettingsNavigationTourElement
      id="entry"
      position="bottom-start"
      title={t('Access Settings here')}
      description={t('Yep. We "moved the cheese", but it\'s for the better...')}
    >
      {tourProps => (
        <AvatarButton
          avatar={avatarProps}
          size={size}
          aria-label={t('Toggle organization menu')}
          {...mergeProps(triggerProps, {className: tourProps.className})}
          ref={mergeRefs(triggerProps.ref, tourProps.ref, triggerRef)}
        />
      )}
    </SettingsNavigationTourElement>
  );
  const createOrganizationItem = makeCreateOrganizationMenuItem();

  if (settingsV3) {
    const memberProjects = sortProjectsByBookmarkAndMembership(
      projects.filter(project => project.isMember),
      bookmarkedSnapshot
    );
    const otherProjects = sortProjectsByBookmarkAndMembership(
      projects.filter(project => !project.isMember),
      bookmarkedSnapshot
    );
    // Unbookmarked projects fill the remaining slots, so the list is not empty
    // when nothing is bookmarked.
    const quickAccessProjects = sortProjectsByBookmarkAndMembership(
      projects,
      bookmarkedSnapshot
    ).slice(0, QUICK_ACCESS_PROJECT_LIMIT);

    return (
      <SettingsNavigationTourElement
        id="projects"
        position="right"
        // The menu closes with the tour, so focus returns to its trigger.
        returnFocusRef={triggerRef}
        title={
          hasNoProjects
            ? getSettingsScopeTitle('project')
            : t('Quick settings-access for your important Projects')
        }
        description={
          hasNoProjects
            ? canCreateProject
              ? t(
                  'Create your first project from this menu. Then star projects to pin their settings shortcuts to this list.'
                )
              : t(
                  'Project settings shortcuts will appear here when projects are available to you. Star projects to pin them to this list.'
                )
            : t(
                'Pin your important Projects to this list, by starring them in the Project page filter.'
              )
        }
      >
        {projectsTourProps => (
          <DropdownMenu
            isOpen={isProjectTourActive || isMenuOpen}
            onOpenChange={open => {
              setMenuOpen(open);
              if (open) {
                setBookmarkedSnapshot(
                  new Set(
                    projects
                      .filter(project => project.isBookmarked)
                      .map(project => project.id)
                  )
                );
              }
              if (!open && isProjectTourActive) {
                settingsTour?.endTour();
              }
            }}
            // Keep the menu open while the tour points into it.
            isDismissable={!isProjectTourActive}
            shouldCloseOnBlur={!isProjectTourActive}
            usePortal
            portalContainerRef={portalContainerRef}
            zIndex={theme.zIndex.modal}
            trigger={trigger}
            maxWidth={258}
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
                    onAction: () =>
                      trackAnalytics('settings.entry_point_clicked', {
                        organization,
                        entry_point: 'org_menu',
                      }),
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
                      singleOrganization ||
                      isDemoModeActive() ||
                      (activeOrgs.length === 0 && inactiveOrgs.length === 0),
                    children: [
                      {
                        key: 'active-orgs',
                        children: orderBy(activeOrgs, ['name']).map(
                          makeOrganizationMenuItem
                        ),
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
                label: getSettingsScopeTitle('project'),
                ref: projectsTourProps.ref,
                hidden: props.hideCurrentOrganizationLinks,
                children: [
                  ...quickAccessProjects.map(project =>
                    makeSettingsProjectMenuItem(project, 'quick_access')
                  ),
                  {
                    key: 'view-all-projects',
                    label: t('View All Projects'),
                    leadingItems: <span aria-hidden="true" />,
                    submenu: {
                      title: t('All Projects'),
                      emptyMessage: t('No projects found'),
                      search: {placeholder: t('Search')},
                      maxWidth: 258,
                    },
                    hidden: projects.length === 0,
                    children: [
                      {
                        key: 'my-projects',
                        label: t('My Projects'),
                        hidden: memberProjects.length === 0,
                        children: memberProjects.map(project =>
                          makeSettingsProjectMenuItem(project, 'all_projects')
                        ),
                      },
                      {
                        key: 'other-projects',
                        label: t('Other Projects'),
                        hidden: otherProjects.length === 0,
                        children: otherProjects.map(project =>
                          makeSettingsProjectMenuItem(project, 'all_projects')
                        ),
                      },
                    ],
                  },
                  {
                    key: 'create-project',
                    label: t('Create Project'),
                    leadingItems: <IconAdd />,
                    to: canCreateProject
                      ? makeProjectsPathname({path: '/new/', organization})
                      : undefined,
                    disabled: !canCreateProject,
                  },
                ],
              },
            ]}
          />
        )}
      </SettingsNavigationTourElement>
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
                    onAction: () =>
                      trackAnalytics('settings.entry_point_clicked', {
                        organization,
                        entry_point: 'org_menu',
                      }),
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
              hidden: singleOrganization || isDemoModeActive(),
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
  trailingAction: MenuItemTrailingAction,
  keyPrefix = 'project'
): MenuItemProps {
  return {
    key: `${keyPrefix}-${project.id}`,
    label: project.slug,
    leadingItems: <ProjectAvatar project={project} size={16} />,
    trailingAction,
    to: `/settings/${organization.slug}/projects/${project.slug}/`,
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
