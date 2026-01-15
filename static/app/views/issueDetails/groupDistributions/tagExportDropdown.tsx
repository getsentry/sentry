import {useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {ExportQueryType, useDataExport} from 'sentry/components/dataExport';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
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

export default function TagExportDropdown({tagKey, group, organization, project}: Props) {
  const [isExportDisabled, setIsExportDisabled] = useState(false);
  const hasDiscoverQuery = organization.features.includes('discover-query');
  const handleDataExport = useDataExport({
    payload: {
      queryType: ExportQueryType.ISSUES_BY_TAG,
      queryInfo: {
        project: project.id,
        group: group.id,
        key: tagKey,
      },
    },
  });

  return (
    <DropdownMenu
      size="xs"
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          borderless
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
              `/${organization.slug}/${project.slug}/issues/${group.id}/tags/${tagKey}/export/`,
              '_blank'
            );
          },
        },
        {
          key: 'export-all',
          label: isExportDisabled ? t('Export in progress...') : t('Export All to CSV'),
          onAction: () => {
            handleDataExport();
            setIsExportDisabled(true);
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
