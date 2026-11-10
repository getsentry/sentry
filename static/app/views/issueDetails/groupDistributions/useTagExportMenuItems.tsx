import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {ExportQueryType, useDataExport} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface UseTagExportMenuItemsProps {
  group: Group;
  organization: Organization;
  project: Project;
  tagKey: string | undefined;
}

/**
 * Menu items for exporting a tag's values to CSV, from the tag details drawer.
 * Returns no items when there is no tag selected.
 */
export function useTagExportMenuItems({
  group,
  organization,
  project,
  tagKey,
}: UseTagExportMenuItemsProps): MenuItemProps[] {
  const hasDiscoverQuery = organization.features.includes('discover-query');
  const {mutate: handleDataExport, isPending, isSuccess} = useDataExport();
  const isExportDisabled = isPending || isSuccess;

  if (!tagKey) {
    return [];
  }

  return [
    {
      key: 'export-page',
      label: t('Export Page to CSV'),
      // TODO(issues): Dropdown menu doesn't support hrefs yet
      onAction: () => {
        window.open(
          `/organizations/${organization.slug}/projects/${project.slug}/issues/${group.id}/tags/${tagKey}/export/`,
          '_blank'
        );
      },
    },
    {
      key: 'export-all',
      label: isExportDisabled ? t('Export in progress...') : t('Export All to CSV'),
      onAction: () => {
        handleDataExport({
          queryType: ExportQueryType.ISSUES_BY_TAG,
          queryInfo: {
            project: project.id,
            group: group.id,
            key: tagKey,
          },
        });
      },
      disabled: isExportDisabled || !hasDiscoverQuery,
      tooltip: hasDiscoverQuery
        ? undefined
        : t('This feature is not available for your organization'),
    },
  ];
}
