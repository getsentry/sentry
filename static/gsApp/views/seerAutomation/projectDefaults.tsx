import {useEffect, useRef} from 'react';

import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ProjectDefaultsForm} from 'getsentry/views/seerAutomation/components/projectDefaults/projectDefaultsForm';

export default function ProjectDefaultsDrawer() {
  const {query} = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {openDrawer} = useDrawer();

  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    openDrawer(
      () => (
        <AnalyticsArea name="project-defaults">
          <DrawerHeader>
            <Text bold>{t('Default Automations for New Projects')}</Text>
          </DrawerHeader>
          <DrawerBody>
            <ProjectDefaultsForm organization={organization} />
          </DrawerBody>
        </AnalyticsArea>
      ),
      {
        ariaLabel: t('Default Automations for New Projects'),
        drawerKey: 'project-defaults-drawer',
        resizable: true,
        onClose: () => {
          navigate({
            pathname: `/settings/${organization.slug}/seer/projects/`,
            query: queryRef.current,
          });
        },
      }
    );
  }, [openDrawer, organization, navigate]);

  return null;
}
