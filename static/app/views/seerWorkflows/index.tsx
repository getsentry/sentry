import {Outlet} from 'react-router';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {
  getAutomationRunsPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

export default function AutomationsLayout() {
  const organization = useOrganization();
  const location = useLocation();
  const activeTab = location.pathname.endsWith('/runs/') ? 'runs' : 'automations';

  return (
    <SentryDocumentTitle title={t('Automations')} orgSlug={organization.slug}>
      <Stack gap="lg" padding="xl">
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'page-title',
            label: t('Automations'),
            trailingActions: {type: 'badge', element: <FeatureBadge type="alpha" />},
          }}
        />
        <Tabs value={activeTab}>
          <TabList>
            <TabList.Item key="automations" to={getAutomationsPath(organization.slug)}>
              {t('Automations')}
            </TabList.Item>
            <TabList.Item key="runs" to={getAutomationRunsPath(organization.slug)}>
              {t('Runs')}
            </TabList.Item>
          </TabList>
        </Tabs>
        <Outlet />
      </Stack>
    </SentryDocumentTitle>
  );
}
