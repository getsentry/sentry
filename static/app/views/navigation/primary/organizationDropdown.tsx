import {useEffect, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {OrganizationAvatar, ProjectAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
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

/**
 * How many projects the menu will list directly before it stops trying to show
 * them all. At or below this count, starring is pointless overhead — there is no
 * list to curate — so every project is listed and the section never sits empty.
 * Above it, only starred projects are listed and "All Projects" is the way in.
 */
const MAX_INLINE_PROJECTS = 8;

interface OrganizationDropdownProps {
  /**
   * When true, hides the settings and project links for the current
   * organization, leaving only the organization switcher.
   */
  hideCurrentOrganizationLinks?: boolean;
  onClick?: () => void;
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

  // Most organizations have only a handful of projects, where starring is pure
  // overhead — list them all so the section is never empty. Past that the list
  // would crowd out the rest of the menu, so it narrows to starred projects and
  // "All Projects" carries the remainder.
  const {inlineProjects, isShowingAllProjects} = useMemo(() => {
    const sorted = orderBy(projects, ['slug']);

    if (sorted.length <= MAX_INLINE_PROJECTS) {
      return {inlineProjects: sorted, isShowingAllProjects: true};
    }

    return {
      inlineProjects: sorted
        .filter(project => project.isBookmarked)
        .slice(0, MAX_INLINE_PROJECTS),
      isShowingAllProjects: false,
    };
  }, [projects]);

  const allProjectsSearch = useSearchableMenuItems({
    items: useMemo(
      () =>
        orderBy(projects, ['slug']).map(project => ({
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
          onClick={e => {
            triggerProps.onClick?.(e);
            props.onClick?.();
          }}
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
          // Reflect what the list below actually is, so the heading does not
          // promise starred projects when it is showing all of them.
          label: isShowingAllProjects ? t('Project Settings') : t('Starred Projects'),
          // Project settings belong to the current organization, so they follow
          // the same access rules as the links above.
          hidden: props.hideCurrentOrganizationLinks,
          children: [
            ...inlineProjects.map(project => makeProjectMenuItem(project, organization)),
            {
              key: 'all-projects',
              label: t('All Projects'),
              leadingItems: <IconAllProjects />,
              // Set expectations before the click: a small number says the
              // submenu is trivial, a large one says to expect the search field.
              trailingItems: (
                <Text size="sm" variant="muted" tabular>
                  {projects.length}
                </Text>
              ),
              // When every project is already listed above, a submenu would just
              // repeat those rows, so link straight to the projects index
              // instead. Otherwise it opens the full searchable list.
              ...(isShowingAllProjects
                ? {to: `/settings/${organization.slug}/projects/`}
                : {
                    submenu: {title: allProjectsSearch.title},
                    children: allProjectsSearch.items,
                  }),
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
