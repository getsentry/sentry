import {Fragment, useRef, useState} from 'react';
import {Outlet} from 'react-router';
import {IconDelete} from '@sentry/icons/delete';
import {IconEdit} from '@sentry/icons/edit';
import {IconPause} from '@sentry/icons/pause';
import {IconPlay} from '@sentry/icons/play';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {EditableText} from 'sentry/components/editableText';
import {NotFound} from 'sentry/components/errors/notFound';
import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
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
import {
  useDeleteConfig,
  useFetchConfigs,
  useIsUpdatingConfig,
  useUpdateConfig,
} from 'sentry/views/seerWorkflows/automations/hooks/configs';
import type {MetricAutomationFormHandle} from 'sentry/views/seerWorkflows/automations/metricAutomationForm';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {WorkflowStrategy} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

import type {AutomationDetailOutletContext} from './configuration';

export default function AutomationDetail() {
  const organization = useOrganization();
  const location = useLocation();
  const activeTab: 'configuration' | 'runs' = location.pathname.endsWith('/runs/')
    ? 'runs'
    : 'configuration';

  const automationsEnabled = useAutomationsEnabled();
  const {automationId} = useParams<{automationId: string}>();
  const basePath = getAutomationDetailPath(organization.slug, automationId);
  const navigate = useNavigate();

  const {data, isPending, isError, refetch} = useFetchConfigs({ids: [automationId]});
  const config: AutomationConfig | undefined = data?.[0];
  const strategy = config?.strategy ?? '';
  const strategyMeta = Object.hasOwn(STRATEGY_META, strategy)
    ? STRATEGY_META[strategy as WorkflowStrategy]
    : undefined;
  const title = config?.name ?? strategyMeta?.label ?? strategy;
  const updateConfig = useUpdateConfig({configId: automationId});
  const deleteConfig = useDeleteConfig({configId: automationId});
  const isUpdatingConfig = useIsUpdatingConfig({configId: automationId});
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [formHasChanges, setFormHasChanges] = useState(false);
  const [monitorsPending, setMonitorsPending] = useState(false);
  const formRef = useRef<MetricAutomationFormHandle>(null);
  const formId = `automation-config-${automationId}`;
  // Leaving the configuration tab unmounts the form, discarding any unsaved changes
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    if (prevActiveTab === 'configuration') {
      setIsConfiguring(false);
    }
  }
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

  const headerDetails = (
    <Stack direction="row" align="center" gap="md" wrap="wrap">
      <Text size="sm" variant="muted">
        {config.dateLastRun === undefined
          ? t('No runs yet')
          : tct('Last run [time]', {
              time: <TimeSince date={config.dateLastRun} tooltipPrefix={t('Last run')} />,
            })}
      </Text>
      <Stack.Separator />
      {nextUpdate && (
        <Fragment>
          <Text size="sm" variant="muted">
            {tct('Next run [time]', {
              time: <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />,
            })}
          </Text>
          <Stack.Separator />
        </Fragment>
      )}
      <Text size="sm" variant="muted">
        {config.strategy === 'breached_metric_investigation'
          ? tn('%s monitor connected', '%s monitors connected', config.monitorIds.length)
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
  );

  const actionButtons = isConfiguring ? (
    <Flex gap="sm">
      <Button
        size="sm"
        onClick={() => {
          formRef.current?.reset();
          setIsConfiguring(false);
        }}
      >
        {t('Cancel')}
      </Button>
      <Button
        size="sm"
        variant="primary"
        type="submit"
        form={formId}
        busy={isUpdatingConfig}
        disabled={monitorsPending || (!formHasChanges && draftName === title)}
      >
        {t('Save')}
      </Button>
    </Flex>
  ) : (
    <Flex gap="sm">
      <Button
        size="sm"
        icon={<IconDelete />}
        aria-label={t('Delete')}
        tooltipProps={{title: t('Delete')}}
        onClick={() =>
          openConfirmModal({
            message: t('Are you sure you want to delete this automation?'),
            confirmText: t('Delete'),
            priority: 'danger',
            onConfirm: () =>
              deleteConfig.mutate(undefined, {
                onSuccess: () => {
                  toast.success(t('Automation deleted.'));
                  navigate(getAutomationsPath(organization.slug));
                },
                onError: () => toast.error(t('Unable to delete automation.')),
              }),
          })
        }
      />
      <Button
        size="sm"
        disabled={isUpdatingConfig}
        aria-label={config.enabled ? t('Disable') : t('Enable')}
        tooltipProps={{title: config.enabled ? t('Disable') : t('Enable')}}
        icon={
          updateConfig.isPending ? (
            <LoadingIndicator size={14} style={{margin: 0}} />
          ) : config.enabled ? (
            <IconPause />
          ) : (
            <IconPlay />
          )
        }
        onClick={() =>
          updateConfig.mutate(
            {enabled: !config.enabled},
            {onError: () => toast.error(t('Unable to update automation.'))}
          )
        }
      />
      <Button
        size="sm"
        icon={<IconEdit />}
        disabled={isUpdatingConfig}
        onClick={() => {
          setDraftName(title);
          setIsConfiguring(true);
          // The form lives on the configuration tab
          if (activeTab !== 'configuration') {
            navigate(basePath);
          }
        }}
      >
        {t('Configure')}
      </Button>
    </Flex>
  );

  // TODO: Placeholder costs until the API provides them
  const headerCosts = (
    <Flex gap="xl">
      <Stack align="end">
        <Text size="sm" variant="muted">
          {t('Cost 30D')}
        </Text>
        <Text size="lg">$mock</Text>
      </Stack>
      <Stack align="end">
        <Text size="sm" variant="muted">
          {t('Cost per Run')}
        </Text>
        <Text size="lg">$mock</Text>
      </Stack>
    </Flex>
  );

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
                {isConfiguring ? (
                  <Heading as="h1" size="xl">
                    <EditableText
                      variant="compact"
                      value={draftName}
                      onChange={setDraftName}
                      // Clearing the name reverts the edit
                      allowEmpty
                      maxLength={64}
                      aria-label={t('Automation Name')}
                    />
                  </Heading>
                ) : (
                  <Heading as="h1" size="xl">
                    {title}
                  </Heading>
                )}
                {config.enabled ? (
                  <Tag variant="success">{t('Active')}</Tag>
                ) : (
                  <Tag variant="warning">{t('Paused')}</Tag>
                )}
              </Flex>
              <Text>{strategyMeta?.description ?? t('No description')}</Text>
              {headerDetails}
            </Stack>
            <Stack gap="md" align="end">
              {actionButtons}
              {headerCosts}
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
          <Outlet
            context={
              {
                config,
                formId,
                formRef,
                isConfiguring,
                name: draftName,
                setFormHasChanges,
                setMonitorsPending,
                onSaved: () => setIsConfiguring(false),
              } satisfies AutomationDetailOutletContext
            }
          />
        </Container>
      </Stack>
    </SentryDocumentTitle>
  );
}
