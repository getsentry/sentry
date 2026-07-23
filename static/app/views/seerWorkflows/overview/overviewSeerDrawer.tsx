import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {SeerDrawer} from 'sentry/components/events/autofix/v3/drawer';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
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

  if (!groupQuery.data || !projectQuery.data) {
    return (
      <Stack gap="xl" padding="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
        <Placeholder height="15rem" />
      </Stack>
    );
  }

  return <SeerDrawer group={groupQuery.data} project={projectQuery.data} />;
}

/**
 * Opens the autofix run drawer (the same SeerDrawer the issue page shows) in
 * place on the overview, fetching the full Group and Project the drawer needs
 * from the lightweight overview row. Reuses the issue page's drawer key so both
 * surfaces open the same drawer slot.
 */
export function useOpenOverviewSeerDrawer() {
  const {openDrawer} = useDrawer();

  return useCallback(
    ({groupId, projectSlug}: OverviewSeerDrawerProps) => {
      openDrawer(
        () => <OverviewSeerDrawer groupId={groupId} projectSlug={projectSlug} />,
        {
          ariaLabel: t('Seer drawer'),
          drawerKey: 'seer-autofix-drawer',
          resizable: true,
          mode: 'passive',
        }
      );
    },
    [openDrawer]
  );
}
