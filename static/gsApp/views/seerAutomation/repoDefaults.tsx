import {useEffect} from 'react';

import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RepoDefaultsForm} from 'getsentry/views/seerAutomation/components/repoDefaults/repoDefaultsForm';

export default function RepoDefaultsDrawer() {
  const {query} = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {openDrawer} = useDrawer();

  useEffect(() => {
    openDrawer(
      () => (
        <AnalyticsArea name="repo-defaults">
          <DrawerHeader>
            <Text bold>{t('Default Code Review for New Repos')}</Text>
          </DrawerHeader>
          <DrawerBody>
            <RepoDefaultsForm organization={organization} />
          </DrawerBody>
        </AnalyticsArea>
      ),
      {
        ariaLabel: t('Default Code Review for New Repos'),
        drawerKey: 'repo-defaults-drawer',
        resizable: true,
        onClose: () => {
          navigate({
            pathname: `/settings/${organization.slug}/seer/repos/`,
            query,
          });
        },
      }
    );
  }, [openDrawer, organization, navigate, query]);

  return null;
}
