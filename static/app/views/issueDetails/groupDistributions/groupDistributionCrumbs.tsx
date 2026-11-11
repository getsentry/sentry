import {IconDownload} from '@sentry/icons/download';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

import {DrawerBreadcrumbs} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {
  useIssueDetailsLinks,
  useIssueDetailsParams,
} from 'sentry/views/issueDetails/useGroupDetailsRoute';

import {DrawerTab} from './types';
import {useTagExportMenuItems} from './useTagExportMenuItems';

interface Props {
  group: Group;
  project: Project;
  tab: DrawerTab;
}

export function GroupDistributionCrumbs({group, project, tab}: Props) {
  const organization = useOrganization();
  const {tagKey} = useIssueDetailsParams();
  const links = useIssueDetailsLinks();
  const exportItems = useTagExportMenuItems({
    group,
    organization,
    project,
    tagKey: tab === DrawerTab.TAGS ? tagKey : undefined,
  });

  const listLabel = tab === DrawerTab.TAGS ? t('All Tags') : t('All Feature Flags');

  if (!tagKey) {
    return <DrawerBreadcrumbs current={{label: listLabel}} />;
  }

  const items: BreadcrumbListProps['items'] = [
    {
      type: 'link',
      label: listLabel,
      to: links.drawer(IssueDetailsDrawer.DISTRIBUTIONS, {tagKey: null, type: tab}),
    },
  ];

  return (
    <DrawerBreadcrumbs
      items={items}
      current={{
        label: tagKey,
        trailingActions:
          exportItems.length > 0
            ? {
                type: 'menu',
                triggerIcon: <IconDownload />,
                triggerLabel: t('Export options'),
                menuSize: 'sm',
                items: exportItems,
              }
            : undefined,
      }}
    />
  );
}
