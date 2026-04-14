import {Fragment} from 'react';
import type {ReactNode} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {getNavigationConfiguration} from 'sentry/views/settings/project/navigationConfiguration';
import type {NavigationGroupProps, NavigationItem} from 'sentry/views/settings/types';

type ProjectSettingsCommandPaletteAction = {
  display: {
    label: string;
  };
  keywords: string[];
  to: string;
};

type ProjectSettingsCommandPaletteSection = {
  icon: ReactNode;
  items: ProjectSettingsCommandPaletteAction[];
  label: string;
};

function shouldShowItem(
  item: NavigationItem,
  context: Omit<NavigationGroupProps, 'items' | 'name' | 'id'>,
  section: {id: string; items: NavigationItem[]; name: string}
) {
  if (typeof item.show === 'function') {
    return item.show({...context, ...section});
  }

  return item.show !== false;
}

export function getProjectSettingsCommandPaletteSections({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}): ProjectSettingsCommandPaletteSection[] {
  const context = {
    access: new Set(organization.access),
    features: new Set(organization.features),
    organization,
    project,
  };

  return getNavigationConfiguration({
    debugFilesNeedsReview: false,
    organization,
    project,
  })
    .map(section => ({
      icon: <ProjectAvatar project={project} size={16} />,
      label: section.name,
      items: section.items
        .filter(item => shouldShowItem(item, context, section))
        .map(item => ({
          display: {
            label: item.title,
          },
          keywords: [section.name, 'project settings', 'settings'],
          to: replaceRouterParams(item.path, {
            orgId: organization.slug,
            projectId: project.slug,
          }),
        })),
    }))
    .filter(section => section.items.length > 0);
}

export function ProjectSettingsCommandPaletteActions({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
  const sections = getProjectSettingsCommandPaletteSections({organization, project});

  return (
    <Fragment>
      {sections.map(section => (
        <CommandPaletteSlot key={section.label} name="page">
          <CMDKAction display={{label: section.label, icon: section.icon}}>
            {section.items.map(item => (
              <CMDKAction key={item.to} {...item} />
            ))}
          </CMDKAction>
        </CommandPaletteSlot>
      ))}
    </Fragment>
  );
}
