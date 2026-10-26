import {Fragment} from 'react';
import {Outlet} from 'react-router';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {TopBar} from 'sentry/views/navigation/topBar';
import {getNextUpdate, PLACEHOLDER_CONFIGS} from 'sentry/views/seerWorkflows/automations';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowConfigsResponse,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

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

  const automationsEnabled = useAutomationsEnabled();
  const {automationId} = useParams<{automationId: string}>();

  // TODO(aliu): Fetch the single config once the API supports it
  const {data} = useQuery(
    apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        staleTime: 0,
      }
    )
  );
  const config = [...PLACEHOLDER_CONFIGS, ...(data?.configs ?? [])].find(
    c => c.id === automationId
  );
  // TODO(aliu): Handle a config id that doesn't exist
  const strategy = config?.strategy ?? '';
  const strategyMeta = Object.hasOwn(STRATEGY_META, strategy)
    ? STRATEGY_META[strategy as WorkflowStrategy]
    : undefined;
  const title = strategyMeta?.label ?? strategy;
  const nextUpdate = config ? getNextUpdate(config.schedule) : undefined;

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
          <Text>{strategyMeta?.description ?? t('No description')}</Text>
          <Stack direction="row" align="center" gap="md" wrap="wrap">
            <Text size="sm" variant="muted">
              {t('(MOCK TEXT) Last run 08:00 UTC')}
            </Text>
            {nextUpdate && (
              <Fragment>
                <Stack.Separator />
                <Text size="sm" variant="muted">
                  {tct('Next run [time]', {
                    time: <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />,
                  })}
                </Text>
              </Fragment>
            )}
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
