import {ProjectAvatar} from '@sentry/scraps/avatar';
import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

import {DrawerBreadcrumbs} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

import {DrawerTab} from './types';

interface Props {
  project: Project;
  tab: DrawerTab;
}

export function GroupDistributionCrumbs({project, tab}: Props) {
  const location = useLocation();
  const {tagKey} = useParams<{tagKey: string}>();
  const {baseUrl} = useGroupDetailsRoute();

  const listLabel = tab === DrawerTab.TAGS ? t('All Tags') : t('All Feature Flags');
  const leadingGraphic = <ProjectAvatar project={project} size={16} />;

  if (!tagKey) {
    return <DrawerBreadcrumbs current={{label: listLabel, leadingGraphic}} />;
  }

  const items: BreadcrumbListProps['items'] = [
    {
      type: 'link',
      label: listLabel,
      leadingGraphic,
      to: {
        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
        query: {...location.query, tab},
      },
    },
  ];

  return <DrawerBreadcrumbs items={items} current={{label: tagKey}} />;
}
