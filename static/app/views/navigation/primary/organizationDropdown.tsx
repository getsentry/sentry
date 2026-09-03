import {useEffect, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {OrganizationAvatar, ProjectAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {OrganizationBadge} from 'sentry/components/idBadge/organizationBadge';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconAdd, IconAllProjects, IconBuilding, IconSettings} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {ProjectStarToggle} from 'sentry/views/navigation/primary/projectStarToggle';
import {useSearchableMenuItems} from 'sentry/views/navigation/primary/useSearchableMenuItems';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

/**
 * How many projects the menu lists directly. Most organizations have fewer than
 * this, so the section shows everything and never sits empty; larger ones get the
 * most relevant few here and reach the rest through "All Projects".
 */
const MAX_INLINE_PROJECTS = 5;

interface OrganizationDropdownProps {
  /**
   * When true, hides the settings and project links for the current
   * organization, leaving only the organization switcher.
   */
  hideCurrentOrganizationLinks?: boolean;
}

export function OrganizationDropdown(props: OrganizationDropdownProps) {
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

  // Mirrors how ProjectPageFilter picks and orders its list, so the two surfaces
  // agree on which projects are the relevant ones.
  const inlineProjects = useMemo(() => {
    const memberProjects = projects.filter(project => project.isMember);

    // "My Projects" is the filter's default selection, so prefer it. Users on no
    // projects at all fall back to everything they can access.
    const candidates = memberProjects.length > 0 ? memberProjects : projects;

    // Starred first, then projects the user is a member of, then alphabetically —
    // the same precedence the filter's list uses, minus its selection key.
    return sortBy(candidates, [
      project => !project.isBookmarked,
      project => !project.isMember,
      project => project.slug,
    ]).slice(0, MAX_INLINE_PROJECTS);
  }, [projects]);

  const allProjectsSearch = useSearchableMenuItems({
    items: useMemo(
      () =>
        // Same precedence as the inline list above, so the relevant projects stay
        // near the top here too.
        sortBy(projects, [
          project => !project.isBookmarked,
          project => !project.isMember,
          project => project.slug,
        ]).map(project => ({
          item: makeProjectMenuItem(project, organization, {starrable: true}),
          searchText: project.slug,
        })),
      [projects, organization]
    ),
    placeholder: t('Search projects'),
    emptyMessage: t('No projects found'),
  });

  const switchOrganizationSearch = useSearchableMenuItems({
    items: useMemo(
      () => [
        ...orderBy(activeOrgs, ['name']).map(org => ({
          item: makeOrganizationMenuItem(org),
          searchText: `${org.name} ${org.slug}`,
        })),
        ...orderBy(inactiveOrgs, ['name']).map(org => ({
          item: makeInactiveOrganizationMenuItem(org),
          searchText: `${org.name} ${org.slug}`,
        })),
      ],
      [activeOrgs, inactiveOrgs]
    ),
    placeholder: t('Search organizations'),
    emptyMessage: t('No organizations found'),
  });

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
        />
      )}
      position="right-start"
      minMenuWidth={274}
      // Organizations and projects are unbounded lists, so cap the height and
      // let them scroll. Inherited by the submenus.
      maxMenuHeight={600}
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
                    label: t('Settings'),
                    leadingItems: <IconSettings />,
                    to: `/settings/${organization.slug}/`,
                    hidden: !organization.access?.includes('org:read'),
                  },
                ]),
            {
              key: 'switch-organization',
              label: t('Switch Organization'),
              leadingItems: <IconBuilding />,
              submenu: {title: switchOrganizationSearch.title},
              hidden: config.singleOrganization || isDemoModeActive(),
              children: [
                ...switchOrganizationSearch.items,
                makeCreateOrganizationMenuItem(),
              ],
            },
          ],
        },
        {
          key: 'project-settings',
          label: t('Projects'),
          // Project settings belong to the current organization, so they follow
          // the same access rules as the links above.
          hidden: props.hideCurrentOrganizationLinks,
          children: [
            // Starrable here too, so the star that drives the ordering is visible
            // on the rows it orders.
            ...inlineProjects.map(project =>
              makeProjectMenuItem(project, organization, {starrable: true})
            ),
            {
              key: 'all-projects',
              label: t('All Projects'),
              leadingItems: <IconAllProjects />,
              // Set expectations before the click: a small number says the submenu
              // is trivial, a large one says to expect the search field.
              trailingItems: (
                <Text size="sm" variant="muted" tabular>
                  {projects.length}
                </Text>
              ),
              submenu: {
                title: allProjectsSearch.title,
                // Pinned below the list so it stays reachable in organizations
                // with enough projects to scroll.
                footer: organization.access?.includes('project:write') ? (
                  <MenuComponents.CTALinkButton
                    icon={<IconAdd />}
                    to={makeProjectsPathname({path: '/new/', organization})}
                  >
                    {t('Create Project')}
                  </MenuComponents.CTALinkButton>
                ) : null,
              },
              children: allProjectsSearch.items,
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
  {starrable = false}: {starrable?: boolean} = {}
): MenuItemProps {
  return {
    key: `project-${project.id}`,
    label: project.slug,
    textValue: project.slug,
    leadingItems: <ProjectAvatar project={project} />,
    // Starring is offered where the user is browsing the full list, which is
    // where they can act on what they find. Pinned rows omit it: the star would
    // only ever unpin, and the row would vanish from under the cursor.
    trailingItems: starrable ? (
      <ProjectStarToggle organization={organization} project={project} />
    ) : undefined,
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
