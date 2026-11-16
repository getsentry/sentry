import {Outlet} from 'react-router';
import {IconAdd} from '@sentry/icons/add';

import {FeatureBadge} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
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
        <Flex justify="between" align="end" gap="lg" borderBottom="primary">
          {/* Tabs stretch to the row height, so size this wrapper to the tab list to keep the active underline on the divider. */}
          <Flex flex="1" minWidth="0">
            <Tabs value={activeTab} size="sm">
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
            </Tabs>
          </Flex>
          <Container padding="0 0 sm 0">
            <LinkButton
              variant="primary"
              size="sm"
              icon={<IconAdd />}
              to={getAutomationCreatePath(organization.slug)}
            >
              {t('Create automation')}
            </LinkButton>
          </Container>
        </Flex>
        <Outlet />
      </Stack>
    </SentryDocumentTitle>
  );
}
