import {Button} from '@sentry/scraps/button';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {ExportQueryType, useDataExport} from 'sentry/components/exports/useDataExport';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface Props {
  group: Group;
  organization: Organization;
  project: Project;
  tagKey: string;
}

export function TagExportDropdown({tagKey, group, organization, project}: Props) {
  const hasDiscoverQuery = organization.features.includes('discover-query');
  const {mutate: handleDataExport, isPending, isSuccess} = useDataExport();
  const isExportDisabled = isPending || isSuccess;

  return (
    <DropdownMenu
      size="xs"
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          variant="transparent"
          size="xs"
          aria-label={t('Export options')}
          icon={<IconDownload />}
        />
      )}
      items={[
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
      ]}
    />
  );
}
