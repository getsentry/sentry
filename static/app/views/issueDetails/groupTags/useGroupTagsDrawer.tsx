import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';

export function useGroupTagsDrawer({
  groupId,
  projectSlug,
}: {
  groupId: string;
  projectSlug: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const organization = useOrganization();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(
      () => <GroupTagsDrawer projectSlug={projectSlug} groupId={groupId} />,
      {
        ariaLabel: t('Tags Drawer'),
        onClose: () => {
          navigate({
            pathname: `/organizations/${organization.slug}/issues/${groupId}/`,
            query: {
              ...location.query,
              tagDrawerSort: undefined,
            },
          });
        },
        shouldCloseOnLocationChange: false,
      }
    );
  }, [location, navigate, drawer, projectSlug, groupId, organization.slug]);

  return {openTagsDrawer};
}
