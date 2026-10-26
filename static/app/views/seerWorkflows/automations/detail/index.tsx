import {Outlet} from 'react-router';

import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {getAutomationsPath} from 'sentry/views/seerWorkflows/utils';

export default function AutomationDetail() {
  const organization = useOrganization();
  const location = useLocation();
  const activeTab: 'configuration' | 'runs' = location.pathname.endsWith('/runs/')
    ? 'runs'
    : 'configuration';
  const basePath =
    activeTab === 'runs'
      ? location.pathname.slice(0, -'runs/'.length)
      : location.pathname;

  // TODO(aliu): Fetch the automation and replace the hardcoded content below
  const title = t('Agentic Triage');

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      <Stack gap="lg" padding="xl">
        <TopBar.Slot
          name="breadcrumbs"
          title={{type: 'page-title', label: title}}
          items={[
            {
              type: 'link',
              label: t('Automations'),
              to: getAutomationsPath(organization.slug),
            },
          ]}
        />
        <Stack gap="xs">
          <Heading as="h1" size="xl">
            {title}
          </Heading>
          <Text>{t('Automatically triage and fix the most fixable Issues')}</Text>
          <Stack direction="row" align="center" gap="md" wrap="wrap">
            <Text size="sm" variant="muted">
              {t('Last run 08:00 UTC')}
            </Text>
            <Stack.Separator />
            <Text size="sm" variant="muted">
              {t('Next run in 2 hours')}
            </Text>
            <Stack.Separator />
            <Text size="sm" variant="muted">
              {t('All projects')}
            </Text>
            <Stack.Separator />
            <Text size="sm" variant="muted">
              {t('Created by Sentry')}
            </Text>
          </Stack>
        </Stack>
        <Tabs value={activeTab} size="sm">
          <TabList>
            <TabList.Item
              key="configuration"
              to={basePath}
              textValue={t('Configuration')}
            >
              <Text bold={activeTab === 'configuration'} variant="inherit">
                {t('Configuration')}
              </Text>
            </TabList.Item>
            <TabList.Item key="runs" to={`${basePath}runs/`} textValue={t('Runs')}>
              <Text bold={activeTab === 'runs'} variant="inherit">
                {t('Runs')}
              </Text>
            </TabList.Item>
          </TabList>
        </Tabs>
        <Outlet />
      </Stack>
    </SentryDocumentTitle>
  );
}
