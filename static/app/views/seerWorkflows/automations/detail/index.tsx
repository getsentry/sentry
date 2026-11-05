import {Fragment} from 'react';
import {Outlet} from 'react-router';
import {IconDelete} from '@sentry/icons/delete';
import {IconPause} from '@sentry/icons/pause';
import {IconPlay} from '@sentry/icons/play';
import {skipToken, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {NotFound} from 'sentry/components/errors/notFound';
import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUserFromId} from 'sentry/utils/useUserFromId';
import {TopBar} from 'sentry/views/navigation/topBar';
import {
  getNextUpdate,
  type AutomationConfig,
} from 'sentry/views/seerWorkflows/automations';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowConfigsResponse,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

export default function AutomationDetail() {
  const organization = useOrganization();
  const location = useLocation();
  const activeTab: 'configuration' | 'runs' = location.pathname.endsWith('/runs/')
    ? 'runs'
    : 'configuration';

  const automationsEnabled = useAutomationsEnabled();
  const {automationId} = useParams<{automationId: string}>();
  const basePath = getAutomationDetailPath(organization.slug, automationId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {id: automationId},
        staleTime: 0,
      }
    )
  );
  const config: AutomationConfig | undefined = data?.configs[0];
  const strategy = config?.strategy ?? '';
  const strategyMeta = Object.hasOwn(STRATEGY_META, strategy)
    ? STRATEGY_META[strategy as WorkflowStrategy]
    : undefined;
  const title = config?.name ?? strategyMeta?.label ?? strategy;
  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/seer/workflows/configs/$configId/',
          {path: {organizationIdOrSlug: organization.slug, configId: automationId}}
        ),
        method: 'PUT',
        data: {enabled},
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/seer/workflows/configs/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      }),
    onError: () => addErrorMessage(t('Unable to update automation.')),
  });
  const deleteAutomation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/seer/workflows/configs/$configId/',
          {path: {organizationIdOrSlug: organization.slug, configId: automationId}}
        ),
        method: 'DELETE',
      }),
    onSuccess: () => {
      addSuccessMessage(t('Automation deleted.'));
      navigate(getAutomationsPath(organization.slug));
    },
    onError: () => addErrorMessage(t('Unable to delete automation.')),
  });
  // Show who last updated the automation, falling back to who created it
  const displayUserId = config?.updatedBy || config?.createdBy;
  const {data: displayUser} = useUserFromId({
    id: displayUserId ? Number(displayUserId) : undefined,
  });
  const nextUpdate =
    config?.enabled && config.strategy !== 'breached_metric_investigation'
      ? getNextUpdate(config.schedule)
      : undefined;

  if (!automationsEnabled) {
    return <NotFound />;
  }

  if (!config) {
    return (
      <Container padding="xl">
        {isPending ? (
          <Fragment>
            <TopBar.Slot
              name="breadcrumbs"
              title={{type: 'page-title', label: t('Automations')}}
            />
            <LoadingIndicator />
          </Fragment>
        ) : isError ? (
          <LoadingError onRetry={refetch} />
        ) : (
          <NotFound />
        )}
      </Container>
    );
  }

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      <Stack>
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
        <Stack
          gap="lg"
          padding="xl xl 0 xl"
          background="secondary"
          borderBottom="primary"
        >
          <Flex justify="between" align="start" gap="xl">
            <Stack gap="xs">
              <Flex gap="md" align="center">
                <Heading as="h1" size="xl">
                  {title}
                </Heading>
                {config.enabled ? (
                  <Tag variant="success">{t('Active')}</Tag>
                ) : (
                  <Tag variant="warning">{t('Paused')}</Tag>
                )}
              </Flex>
              <Text>{strategyMeta?.description ?? t('No description')}</Text>
              <Stack direction="row" align="center" gap="md" wrap="wrap">
                <Text size="sm" variant="muted">
                  {config.dateLastRun === undefined
                    ? t('No runs yet')
                    : tct('Last run [time]', {
                        time: (
                          <TimeSince
                            date={config.dateLastRun}
                            tooltipPrefix={t('Last run')}
                          />
                        ),
                      })}
                </Text>
                <Stack.Separator />
                {nextUpdate && (
                  <Fragment>
                    <Text size="sm" variant="muted">
                      {tct('Next run [time]', {
                        time: (
                          <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />
                        ),
                      })}
                    </Text>
                    <Stack.Separator />
                  </Fragment>
                )}
                <Text size="sm" variant="muted">
                  {config.strategy === 'breached_metric_investigation'
                    ? tn(
                        '%s monitor connected',
                        '%s monitors connected',
                        config.monitorIds.length
                      )
                    : config.projects.includes(ALL_ACCESS_PROJECTS)
                      ? t('All projects')
                      : tn('%s project', '%s projects', config.projects.length)}
                </Text>
                {displayUserId && (
                  <Fragment>
                    <Stack.Separator />
                    <Flex gap="xs" align="center">
                      <Text size="sm" variant="muted">
                        {config.updatedBy ? t('Last updated by') : t('Created by')}
                      </Text>
                      {displayUser ? (
                        <UserBadge
                          user={displayUser}
                          hideEmail
                          avatarSize={16}
                          avatarProps={{hasTooltip: true}}
                          displayName={
                            <Text size="sm" variant="muted">
                              {displayUser.name || displayUser.email}
                            </Text>
                          }
                        />
                      ) : (
                        <Text size="sm" variant="muted">
                          {displayUserId}
                        </Text>
                      )}
                    </Flex>
                  </Fragment>
                )}
              </Stack>
            </Stack>
            <Stack gap="md" align="end">
              <Flex gap="sm">
                <Button
                  size="sm"
                  disabled={toggleEnabled.isPending}
                  icon={
                    toggleEnabled.isPending ? (
                      <LoadingIndicator size={14} style={{margin: 0}} />
                    ) : config.enabled ? (
                      <IconPause />
                    ) : (
                      <IconPlay />
                    )
                  }
                  onClick={() => toggleEnabled.mutate(!config.enabled)}
                >
                  {config.enabled ? t('Pause') : t('Resume')}
                </Button>
                <Button
                  size="sm"
                  icon={<IconDelete />}
                  aria-label={t('Delete')}
                  onClick={() =>
                    openConfirmModal({
                      message: t('Are you sure you want to delete this automation?'),
                      confirmText: t('Delete'),
                      priority: 'danger',
                      onConfirm: () => deleteAutomation.mutate(),
                    })
                  }
                />
              </Flex>
              {/* TODO: Placeholder costs until the API provides them */}
              <Flex gap="xl">
                <Stack align="end">
                  <Text size="sm" variant="muted">
                    {t('Cost 30D')}
                  </Text>
                  <Text size="lg">$140.69</Text>
                </Stack>
                <Stack align="end">
                  <Text size="sm" variant="muted">
                    {t('Cost per Run')}
                  </Text>
                  <Text size="lg">$2.50</Text>
                </Stack>
              </Flex>
            </Stack>
          </Flex>
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
        </Stack>
        <Container padding="xl">
          <Outlet context={config} />
        </Container>
      </Stack>
    </SentryDocumentTitle>
  );
}
