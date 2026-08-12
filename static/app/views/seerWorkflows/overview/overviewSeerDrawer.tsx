import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {SeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface OverviewSeerDrawerProps {
  groupId: string;
  projectSlug: string;
}

function OverviewSeerDrawer({groupId, projectSlug}: OverviewSeerDrawerProps) {
  const organization = useOrganization();
  const groupQuery = useGroup({groupId});
  const projectQuery = useDetailedProject({orgSlug: organization.slug, projectSlug});

  if (
    (!groupQuery.data && groupQuery.isError) ||
    (!projectQuery.data && projectQuery.isError)
  ) {
    return (
      <Stack padding="xl">
        <LoadingError
          onRetry={() => {
            if (!groupQuery.data) {
              void groupQuery.refetch();
            }
            if (!projectQuery.data) {
              void projectQuery.refetch();
            }
          }}
        />
      </Stack>
    );
  }

  if (!groupQuery.data || !projectQuery.data) {
    return (
      <Stack gap="xl" padding="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
        <Placeholder height="15rem" />
      </Stack>
    );
  }

  return <SeerDrawer key={groupId} group={groupQuery.data} project={projectQuery.data} />;
}

export function useOpenOverviewSeerDrawer() {
  const {openDrawer} = useDrawer();
  const location = useLocation();
  const organization = useOrganization();
  const canOpenSeerDrawer =
    organization.features.includes('gen-ai-features') && !organization.hideAiFeatures;

  const openSeerDrawer = useCallback(
    ({groupId, projectSlug}: OverviewSeerDrawerProps) => {
      if (!canOpenSeerDrawer) {
        return;
      }

      openDrawer(
        () => <OverviewSeerDrawer groupId={groupId} projectSlug={projectSlug} />,
        {
          ariaLabel: t('Seer drawer'),
          drawerKey: 'seer-autofix-drawer',
          resizable: true,
          mode: 'passive',
          shouldCloseOnLocationChange: nextLocation =>
            nextLocation.pathname !== location.pathname,
        }
      );
    },
    [canOpenSeerDrawer, location.pathname, openDrawer]
  );

  return {canOpenSeerDrawer, openSeerDrawer};
}
