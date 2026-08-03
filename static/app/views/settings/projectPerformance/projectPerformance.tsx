import {Fragment, useState} from 'react';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Scope} from 'sentry/types/core';
import type {DetailedProject} from 'sentry/types/project';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {DetectorAutoSaveField} from './detectorFields';
import {
  CALCULATION_METHOD_OPTIONS,
  DetectorConfigAdmin,
  generalSettingsSchema,
  getGeneralSettingsQueryOptions,
  getPerformanceIssueSettingsQueryOptions,
  getProjectDetectorSettings,
  getRetentionPriorityFields,
  getThresholdQueryOptions,
  handleSuperUserError,
  projectDetectorSettingsId,
  regressionAdminSchema,
  thresholdSettingsSchema,
  type DetectorFieldGroup,
  type GeneralSettings,
  type ProjectPerformanceSettings,
  type ProjectThreshold,
  type ThresholdMetric,
} from './detectorSettings';

export {
  allowedCountValues,
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
  DetectorConfigCustomer,
  projectDetectorSettingsId,
  retentionPrioritiesLabels,
} from './detectorSettings';

function GeneralSettingsSection({
  general,
  hasWriteAccess,
}: {
  general: GeneralSettings | undefined;
  hasWriteAccess: boolean;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/performance/configure/`;

  return (
    <Feature features="organizations:insight-modules">
      <FieldGroup title={t('General')}>
        <AutoSaveForm
          name="enable_images"
          schema={generalSettingsSchema}
          initialValue={Boolean(general?.enable_images)}
          mutationOptions={{
            mutationFn: (data: {enable_images: boolean}) =>
              fetchMutation({url: endpoint, method: 'POST', data}),
            onSuccess: (_data, variables) => {
              queryClient.setQueryData(
                getGeneralSettingsQueryOptions(organization.slug, projectSlug).queryKey,
                previous =>
                  previous
                    ? {
                        json: {
                          ...previous.json,
                          enable_images: variables.enable_images,
                        },
                        headers: previous.headers,
                      }
                    : previous
              );
            },
          }}
        >
          {field => (
            <field.Layout.Row
              label={t('Images')}
              hintText={t('Enables images from real data to be displayed')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Feature>
  );
}

function ThresholdSettingsSection({
  hasWriteAccess,
  isResetting,
  onResetAll,
  resetVersion,
  threshold,
}: {
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  resetVersion: number;
  threshold: ProjectThreshold;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;

  const cacheThreshold = (data: ProjectThreshold) =>
    queryClient.setQueryData(
      getThresholdQueryOptions(organization.slug, projectSlug).queryKey,
      previous => ({json: data, headers: previous?.headers ?? {}})
    );

  return (
    <FieldGroup title={t('Threshold Settings')}>
      <AutoSaveForm
        key={`metric-${resetVersion}`}
        name="metric"
        schema={thresholdSettingsSchema}
        initialValue={
          threshold.metric === 'lcp' || threshold.metric === 'duration'
            ? threshold.metric
            : null
        }
        mutationOptions={{
          mutationFn: (data: {metric: ThresholdMetric}) =>
            fetchMutation<ProjectThreshold>({url: endpoint, method: 'POST', data}),
          onSuccess: data => {
            trackAnalytics('performance_views.project_transaction_threshold.change', {
              organization,
              from: threshold.metric,
              to: data.metric,
              key: 'metric',
            });
            cacheThreshold(data);
          },
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Calculation Method')}
            hintText={tct(
              'This determines which duration is used to set your thresholds. By default, we use transaction duration which measures the entire length of the transaction. You can also set this to use a [link:Web Vital].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/" />
                ),
              }
            )}
          >
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              disabled={!hasWriteAccess}
              options={CALCULATION_METHOD_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        key={`threshold-${resetVersion}`}
        name="threshold"
        schema={thresholdSettingsSchema}
        initialValue={threshold.threshold ?? ''}
        mutationOptions={{
          mutationFn: (data: {threshold: string}) =>
            fetchMutation<ProjectThreshold>({url: endpoint, method: 'POST', data}),
          onSuccess: data => {
            trackAnalytics('performance_views.project_transaction_threshold.change', {
              organization,
              from: threshold.threshold,
              to: data.threshold,
              key: 'threshold',
            });
            cacheThreshold(data);
          },
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Response Time Threshold (ms)')}
            hintText={tct(
              'Define what a satisfactory response time is based on the calculation method above. This will affect how your [link1:Apdex] and [link2:User Misery] thresholds are calculated. For example, misery will be 4x your satisfactory response time.',
              {
                link1: (
                  <ExternalLink href="https://docs.sentry.io/performance-monitoring/performance/metrics/#apdex" />
                ),
                link2: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#user-misery" />
                ),
              }
            )}
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={t('300')}
              disabled={!hasWriteAccess}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <Flex justify="end">
        <Button onClick={onResetAll} busy={isResetting} disabled={!hasWriteAccess}>
          {t('Reset All')}
        </Button>
      </Flex>
    </FieldGroup>
  );
}

function SamplingPrioritiesSection({
  hasWriteAccess,
  project,
}: {
  hasWriteAccess: boolean;
  project: DetailedProject;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const priorityFields = getRetentionPriorityFields(organization);
  const projectQueryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug,
  });
  const mutationKey = ['project-sampling-priorities', project.id];
  const isUpdatingSamplingPriority = useIsMutating({mutationKey}) > 0;

  const isPriorityActive = (name: DynamicSamplingBiasType) =>
    project.dynamicSamplingBiases?.find(bias => bias.id === name)?.active ?? false;

  return (
    <Feature features="organizations:dynamic-sampling">
      <FieldGroup title={t('Sampling Priorities')}>
        {priorityFields.map(priority => (
          <AutoSaveForm
            key={`${priority.name}-${isPriorityActive(priority.name)}`}
            name={priority.name}
            schema={z.object({[priority.name]: z.boolean()})}
            initialValue={isPriorityActive(priority.name)}
            mutationOptions={{
              mutationKey,
              mutationFn: (data: Record<string, boolean>) =>
                fetchMutation<DetailedProject>({
                  url: endpoint,
                  method: 'PUT',
                  data: {
                    // Submit every known priority, not just the one that changed —
                    // the backend fills in unlisted ids from hardcoded defaults
                    // rather than the project's current settings.
                    dynamicSamplingBiases: priorityFields.map(({name}) => ({
                      id: name,
                      active:
                        name === priority.name
                          ? (data[priority.name] ?? false)
                          : isPriorityActive(name),
                    })),
                  },
                }),
              onSuccess: (response, variables) => {
                ProjectsStore.onUpdateSuccess(response);
                queryClient.setQueryData(projectQueryKey, previous => ({
                  json: response,
                  headers: previous?.headers ?? {},
                }));
                trackAnalytics(
                  variables[priority.name]
                    ? 'dynamic_sampling_settings.priority_enabled'
                    : 'dynamic_sampling_settings.priority_disabled',
                  {organization, project_id: project.id, id: priority.name}
                );
              },
            }}
          >
            {field => (
              <field.Layout.Row label={priority.label} hintText={priority.hintText}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasWriteAccess || isUpdatingSamplingPriority}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        ))}
        <Flex justify="end">
          <LinkButton
            external
            href="https://docs.sentry.io/product/performance/performance-at-scale/"
          >
            {t('Read docs')}
          </LinkButton>
        </Flex>
      </FieldGroup>
    </Feature>
  );
}

function AdminRegressionSettingsSection({
  performanceIssueSettings,
}: {
  performanceIssueSettings: ProjectPerformanceSettings;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;

  const cacheSetting = (setting: ProjectPerformanceSettings) =>
    queryClient.setQueryData(
      getPerformanceIssueSettingsQueryOptions(organization.slug, projectSlug).queryKey,
      previous =>
        previous
          ? {json: {...previous.json, ...setting}, headers: previous.headers}
          : previous
    );

  return (
    <FieldGroup
      title={t('### INTERNAL ONLY ### - Performance Issues Admin Detector Settings')}
    >
      <AutoSaveForm
        name="transaction_duration_regression_detection_enabled"
        schema={regressionAdminSchema}
        initialValue={Boolean(
          performanceIssueSettings[
            DetectorConfigAdmin.TRANSACTION_DURATION_REGRESSION_ENABLED
          ]
        )}
        mutationOptions={{
          mutationFn: (data: {
            transaction_duration_regression_detection_enabled: boolean;
          }) => fetchMutation({url: endpoint, method: 'PUT', data}),
          onSuccess: (_data, variables) => cacheSetting(variables),
          onError: handleSuperUserError,
        }}
      >
        {field => (
          <field.Layout.Row label={t('Transaction Duration Regression Enabled')}>
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
      <AutoSaveForm
        name="function_duration_regression_detection_enabled"
        schema={regressionAdminSchema}
        initialValue={Boolean(
          performanceIssueSettings[
            DetectorConfigAdmin.FUNCTION_DURATION_REGRESSION_ENABLED
          ]
        )}
        mutationOptions={{
          mutationFn: (data: {function_duration_regression_detection_enabled: boolean}) =>
            fetchMutation({url: endpoint, method: 'PUT', data}),
          onSuccess: (_data, variables) => cacheSetting(variables),
          onError: handleSuperUserError,
        }}
      >
        {field => (
          <field.Layout.Row label={t('Function Duration Regression Enabled')}>
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

function DetectorThresholdsSection({
  detectorGroups,
  hasWriteAccess,
  isResetting,
  onResetAll,
  performanceIssueSettings,
  resetVersion,
}: {
  detectorGroups: DetectorFieldGroup[];
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  performanceIssueSettings: ProjectPerformanceSettings;
  resetVersion: number;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;

  const areAllConfigurationsDisabled = Object.values(DetectorConfigAdmin).every(
    th => !performanceIssueSettings[th]
  );

  return (
    <Container id={projectDetectorSettingsId}>
      <FieldGroup title={t('Performance Issues - Detector Threshold Settings')}>
        {detectorGroups
          .filter(group => group.fields.some(field => field.visible !== false))
          .map(group => (
            <Disclosure key={group.title} defaultExpanded={!group.initiallyCollapsed}>
              <Disclosure.Title>{group.title}</Disclosure.Title>
              <Disclosure.Content>
                <Stack gap="lg">
                  {group.fields.map(field => (
                    <DetectorAutoSaveField
                      key={`${field.name}-${resetVersion}`}
                      field={field}
                      initialValue={
                        performanceIssueSettings[field.name] ??
                        field.defaultValue ??
                        (field.type === 'boolean'
                          ? false
                          : field.type === 'string'
                            ? ''
                            : 0)
                      }
                      endpoint={endpoint}
                      projectSlug={projectSlug}
                    />
                  ))}
                </Stack>
              </Disclosure.Content>
            </Disclosure>
          ))}
        <Flex justify="end">
          <Confirm
            message={t('Are you sure you wish to reset all detector thresholds?')}
            onConfirm={onResetAll}
            disabled={!hasWriteAccess || areAllConfigurationsDisabled}
          >
            <Button busy={isResetting}>{t('Reset All Thresholds')}</Button>
          </Confirm>
        </Flex>
      </FieldGroup>
    </Container>
  );
}

export function ProjectPerformance() {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const [thresholdResetVersion, setThresholdResetVersion] = useState(0);
  const [detectorResetVersion, setDetectorResetVersion] = useState(0);

  const thresholdEndpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;
  const performanceIssuesEndpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;
  const thresholdQueryOptions = getThresholdQueryOptions(organization.slug, projectSlug);
  const performanceIssueSettingsQueryOptions = getPerformanceIssueSettingsQueryOptions(
    organization.slug,
    projectSlug
  );
  const generalSettingsQueryOptions = getGeneralSettingsQueryOptions(
    organization.slug,
    projectSlug
  );

  const {
    data: project,
    isPending: isPendingProject,
    isError: isErrorProject,
  } = useDetailedProject({projectSlug, orgSlug: organization.slug});

  const hasWebVitalsSeerSuggestions = useHasSeerWebVitalsSuggestions(project);
  const hasAIIssueDetection =
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('ai-issue-detection') &&
    !organization.hideAiFeatures;

  const {
    data: threshold,
    isPending: isPendingThreshold,
    isError: isErrorThreshold,
  } = useQuery(thresholdQueryOptions);

  const {
    data: performanceIssueSettings,
    isPending: isPendingPerformanceIssueSettings,
    isError: isErrorPerformanceIssueSettings,
  } = useQuery(performanceIssueSettingsQueryOptions);

  const {
    data: general,
    isPending: isPendingGeneral,
    isError: isErrorGeneral,
  } = useQuery(generalSettingsQueryOptions);

  const {mutate: resetThresholdSettings, isPending: isPendingResetThresholdSettings} =
    useMutation({
      mutationFn: () => fetchMutation({url: thresholdEndpoint, method: 'DELETE'}),
      onMutate: () => {
        trackAnalytics('performance_views.project_transaction_threshold.clear', {
          organization,
        });
      },
      onSuccess: async () => {
        await queryClient.fetchQuery(thresholdQueryOptions);
        setThresholdResetVersion(version => version + 1);
      },
    });

  const {mutate: resetThresholds, isPending: isPendingResetThresholds} = useMutation({
    mutationFn: () => fetchMutation({url: performanceIssuesEndpoint, method: 'DELETE'}),
    onMutate: () => {
      trackAnalytics('performance_views.project_issue_detection_thresholds_reset', {
        organization,
        project_slug: projectSlug,
      });
    },
    onSuccess: async () => {
      await queryClient.fetchQuery(performanceIssueSettingsQueryOptions);
      setDetectorResetVersion(version => version + 1);
    },
  });

  if (
    isPendingThreshold ||
    isPendingPerformanceIssueSettings ||
    isPendingGeneral ||
    isPendingProject
  ) {
    return (
      <Container padding="lg">
        <LoadingIndicator />
      </Container>
    );
  }

  if (
    isErrorThreshold ||
    isErrorPerformanceIssueSettings ||
    isErrorGeneral ||
    isErrorProject
  ) {
    return <LoadingError />;
  }

  const requiredScopes: Scope[] = ['project:write'];
  const hasWriteAccess = hasEveryAccess(requiredScopes, {organization, project});

  const detectorGroups = getProjectDetectorSettings({
    hasAccess: hasWriteAccess,
    hasAIIssueDetection,
    hasWebVitalsSeerSuggestions,
    organization,
    performanceIssueSettings,
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Performance')} projectSlug={projectSlug} />
      <SettingsPageHeader title={t('Performance')} />
      <ProjectPermissionAlert project={project} />
      <GeneralSettingsSection general={general} hasWriteAccess={hasWriteAccess} />
      <ThresholdSettingsSection
        threshold={threshold}
        hasWriteAccess={hasWriteAccess}
        isResetting={isPendingResetThresholdSettings}
        onResetAll={() => resetThresholdSettings()}
        resetVersion={thresholdResetVersion}
      />
      <SamplingPrioritiesSection project={project} hasWriteAccess={hasWriteAccess} />
      {isActiveSuperuser() && (
        <AdminRegressionSettingsSection
          performanceIssueSettings={performanceIssueSettings}
        />
      )}
      <DetectorThresholdsSection
        detectorGroups={detectorGroups}
        performanceIssueSettings={performanceIssueSettings}
        hasWriteAccess={hasWriteAccess}
        isResetting={isPendingResetThresholds}
        onResetAll={() => resetThresholds()}
        resetVersion={detectorResetVersion}
      />
    </Fragment>
  );
}
