import {Outlet} from 'react-router';
import {IconAdd} from '@sentry/icons/add';

import {FeatureBadge} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

import {
  getAutomationCreatePath,
  getAutomationRunsPath,
  getAutomationsPath,
  useAutomationsEnabled,
} from './utils';

export default function AutomationsLayout() {
  const organization = useOrganization();
  const location = useLocation();
  const automationsEnabled = useAutomationsEnabled();
  const activeTab: 'automations' | 'runs' = location.pathname.includes(
    '/seer/automations/runs/'
  )
    ? 'runs'
    : 'automations';

  if (!automationsEnabled) {
    return <NotFound />;
  }

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
        <Flex justify="between" align="center" gap="lg">
          <Tabs value={activeTab} size="sm">
            {({TabList}) => (
              <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
                <TabList>
                  <TabList.Item
                    key="automations"
                    to={getAutomationsPath(organization.slug)}
                    textValue={t('Automations')}
                  >
                    <Text bold={activeTab === 'automations'} variant="inherit">
                      {t('Automations')}
                    </Text>
                  </TabList.Item>
                  <TabList.Item
                    key="runs"
                    to={getAutomationRunsPath(organization.slug)}
                    textValue={t('Runs')}
                  >
                    <Text bold={activeTab === 'runs'} variant="inherit">
                      {t('Runs')}
                    </Text>
                  </TabList.Item>
                </TabList>
              </Stack>
            )}
          </Tabs>
          <LinkButton
            variant="primary"
            icon={<IconAdd />}
            to={getAutomationCreatePath(organization.slug)}
          >
            {t('Create automation')}
          </LinkButton>
        </Flex>
        <Outlet />
      </Stack>
    </SentryDocumentTitle>
  );
}
