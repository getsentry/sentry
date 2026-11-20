import {IconDownload} from '@sentry/icons/download';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

import {DrawerBreadcrumbs} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

import {DrawerTab} from './types';
import {useTagExportMenuItems} from './useTagExportMenuItems';

interface Props {
  group: Group;
  project: Project;
  tab: DrawerTab;
}

export function GroupDistributionCrumbs({group, project, tab}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const {baseUrl} = useGroupDetailsRoute();
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
      to: {
        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
        query: {...location.query, tab},
      },
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
