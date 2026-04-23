import {Fragment, type ReactNode} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {IconCode, IconProject, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {getNavigationConfiguration} from 'sentry/views/settings/project/navigationConfiguration';
import type {NavigationGroupProps, NavigationItem} from 'sentry/views/settings/types';

type ProjectSettingsCommandPaletteEntry = {
  display: {
    label: string;
  };
  keywords: string[];
  to: string;
};

type ProjectSettingsCommandPaletteGroup = {
  items: Array<{
    display: {
      label: string;
    };
    keywords: string[];
    to: string;
  }>;
  label: string;
  icon?: ReactNode;
};

type ProjectSettingsCommandPaletteSection = {
  items: Array<ProjectSettingsCommandPaletteEntry | ProjectSettingsCommandPaletteGroup>;
  label: string;
  icon?: ReactNode;
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
  const groupedSectionIds = new Set([
    'settings-project',
    'settings-processing',
    'settings-sdk',
    'settings-legacy-integrations',
  ]);

  const sections = getNavigationConfiguration({
    debugFilesNeedsReview: false,
    organization,
    project,
  })
    .map(section => {
      const label =
        section.id === 'settings-project'
          ? t('General')
          : section.id === 'settings-sdk'
            ? t('SDK setup')
            : section.name;

      return {
        id: section.id,
        icon: groupedSectionIds.has(section.id) ? (
          section.id === 'settings-project' ? (
            <IconProject />
          ) : section.id === 'settings-processing' ? (
            <IconStack />
          ) : section.id === 'settings-sdk' ? (
            <IconCode />
          ) : undefined
        ) : (
          <ProjectAvatar project={project} size={16} />
        ),
        label,
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
      };
    })
    .filter(section => section.items.length > 0);
  const groupedSections = sections.filter(section => groupedSectionIds.has(section.id));
  const ungroupedSections = sections.filter(
    section => !groupedSectionIds.has(section.id)
  );

  if (groupedSections.length === 0) {
    return ungroupedSections;
  }

  return [
    {
      icon: <ProjectAvatar project={project} size={16} />,
      label: project.slug,
      items: groupedSections.map(section =>
        section.id === 'settings-legacy-integrations' && section.items.length > 0
          ? section.items[0]!
          : section
      ),
    },
    ...ungroupedSections,
  ];
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
      {sections.map(section => {
        return (
          <CommandPaletteSlot key={section.label} name="page">
            <CMDKAction display={{label: section.label, icon: section.icon}}>
              {section.items.map(item => {
                if ('items' in item) {
                  return (
                    <CMDKAction
                      key={item.label}
                      display={{label: item.label, icon: item.icon}}
                    >
                      {item.items.map(action => (
                        <CMDKAction key={action.to} {...action} />
                      ))}
                    </CMDKAction>
                  );
                }

                return <CMDKAction key={item.to} {...item} />;
              })}
            </CMDKAction>
          </CommandPaletteSlot>
        );
      })}
    </Fragment>
  );
}
