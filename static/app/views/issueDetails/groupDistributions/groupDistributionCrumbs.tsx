import {ProjectAvatar} from '@sentry/scraps/avatar';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {
  CrumbContainer,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface Props {
  group: Group;
  project: Project;
  tab: DrawerTab;
}

export default function GroupDistributionCrumbs({group, project, tab}: Props) {
  const location = useLocation();
  const {tagKey} = useParams<{tagKey: string}>();

  const {baseUrl} = useGroupDetailsRoute();
  const crumbs: Crumb[] = [
    {
      label: (
        <CrumbContainer>
          <ProjectAvatar project={project} />
          <ShortId>{group.shortId}</ShortId>
        </CrumbContainer>
      ),
    },
  ];
  if (tab === DrawerTab.TAGS) {
    crumbs.push({
      label: t('All Tags'),
      to: tagKey
        ? {
            pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
            query: {...location.query, tab: DrawerTab.TAGS},
          }
        : undefined,
    });
  } else if (tab === DrawerTab.FEATURE_FLAGS) {
    crumbs.push({
      label: t('All Feature Flags'),
      to: tagKey
        ? {
            pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
            query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
          }
        : undefined,
    });
  }
  if (tagKey) {
    crumbs.push({label: tagKey});
  }

  return <NavigationCrumbs crumbs={crumbs} />;
}
