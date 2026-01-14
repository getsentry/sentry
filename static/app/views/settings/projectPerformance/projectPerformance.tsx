import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {Field, JsonFormObject} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Scope} from 'sentry/types/core';
import {IssueTitle, IssueType} from 'sentry/types/group';
import type {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

// These labels need to be exported so that they can be used in audit logs
export const retentionPrioritiesLabels = {
  boostLatestRelease: t('Prioritize new releases'),
  boostEnvironments: t('Prioritize dev environments'),
  boostLowVolumeTransactions: t('Prioritize low-volume transactions'),
  ignoreHealthChecks: t('Deprioritize health checks'),
  minimumSampleRate: t('Always use project sample rate'),
};

export const allowedDurationValues: number[] = [
  50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500,
  3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500,
  10000,
]; // In milliseconds

export const allowedPercentageValues: number[] = [
  0.2, 0.25, 0.3, 0.33, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95,
];

export const allowedSizeValues: number[] = [
  50000, 100000, 200000, 300000, 400000, 500000, 512000, 600000, 700000, 800000, 900000,
  1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000, 9000000,
  10000000,
]; // 50kb to 10MB in bytes

export const allowedCountValues: number[] = [5, 10, 20, 50, 100];

export const projectDetectorSettingsId = 'detector-threshold-settings';

type ProjectPerformanceSettings = Record<string, number | boolean>;

enum DetectorConfigAdmin {
  N_PLUS_DB_ENABLED = 'n_plus_one_db_queries_detection_enabled',
  SLOW_DB_ENABLED = 'slow_db_queries_detection_enabled',
  DB_MAIN_THREAD_ENABLED = 'db_on_main_thread_detection_enabled',
  FILE_IO_ENABLED = 'file_io_on_main_thread_detection_enabled',
  CONSECUTIVE_DB_ENABLED = 'consecutive_db_queries_detection_enabled',
  RENDER_BLOCK_ASSET_ENABLED = 'large_render_blocking_asset_detection_enabled',
  UNCOMPRESSED_ASSET_ENABLED = 'uncompressed_assets_detection_enabled',
  LARGE_HTTP_PAYLOAD_ENABLED = 'large_http_payload_detection_enabled',
  N_PLUS_ONE_API_CALLS_ENABLED = 'n_plus_one_api_calls_detection_enabled',
  CONSECUTIVE_HTTP_ENABLED = 'consecutive_http_spans_detection_enabled',
  HTTP_OVERHEAD_ENABLED = 'http_overhead_detection_enabled',
  TRANSACTION_DURATION_REGRESSION_ENABLED = 'transaction_duration_regression_detection_enabled',
  FUNCTION_DURATION_REGRESSION_ENABLED = 'function_duration_regression_detection_enabled',
  DB_QUERY_INJECTION_ENABLED = 'db_query_injection_detection_enabled',
  WEB_VITALS_ENABLED = 'web_vitals_detection_enabled',
}

export enum DetectorConfigCustomer {
  SLOW_DB_DURATION = 'slow_db_query_duration_threshold',
  N_PLUS_DB_DURATION = 'n_plus_one_db_duration_threshold',
  N_PLUS_DB_COUNT = 'n_plus_one_db_count',
  N_PLUS_API_CALLS_DURATION = 'n_plus_one_api_calls_total_duration_threshold',
  RENDER_BLOCKING_ASSET_RATIO = 'render_blocking_fcp_ratio',
  LARGE_HTTP_PAYLOAD_SIZE = 'large_http_payload_size_threshold',
  LARGE_HTTP_PAYLOAD_FILTERED_PATHS = 'large_http_payload_filtered_paths',
  DB_ON_MAIN_THREAD_DURATION = 'db_on_main_thread_duration_threshold',
  FILE_IO_MAIN_THREAD_DURATION = 'file_io_on_main_thread_duration_threshold',
  UNCOMPRESSED_ASSET_DURATION = 'uncompressed_asset_duration_threshold',
  UNCOMPRESSED_ASSET_SIZE = 'uncompressed_asset_size_threshold',
  CONSECUTIVE_DB_MIN_TIME_SAVED = 'consecutive_db_min_time_saved_threshold',
  CONSECUTIVE_HTTP_MIN_TIME_SAVED = 'consecutive_http_spans_min_time_saved_threshold',
  HTTP_OVERHEAD_REQUEST_DELAY = 'http_request_delay_threshold',
  SQL_INJECTION_QUERY_VALUE_LENGTH = 'sql_injection_query_value_length_threshold',
  WEB_VITALS_COUNT = 'web_vitals_count',
}

type ProjectThreshold = {
  metric: string;
  threshold: string;
  editedBy?: string;
  id?: string;
};

const formFields: Field[] = [
  {
    name: 'metric',
    type: 'select',
    label: t('Calculation Method'),
    options: [
      {value: 'duration', label: t('Transaction Duration')},
      {value: 'lcp', label: t('Largest Contentful Paint')},
    ],
    help: tct(
      'This determines which duration is used to set your thresholds. By default, we use transaction duration which measures the entire length of the transaction. You can also set this to use a [link:Web Vital].',
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/" />
        ),
      }
    ),
  },
  {
    name: 'threshold',
    type: 'string',
    label: t('Response Time Threshold (ms)'),
    placeholder: t('300'),
    help: tct(
      'Define what a satisfactory response time is based on the calculation method above. This will affect how your [link1:Apdex] and [link2:User Misery] thresholds are calculated. For example, misery will be 4x your satisfactory response time.',
      {
        link1: (
          <ExternalLink href="https://docs.sentry.io/performance-monitoring/performance/metrics/#apdex" />
        ),
        link2: (
          <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#user-misery" />
        ),
      }
    ),
  },
];

const getThresholdQueryKey = (orgSlug: string, projectSlug: string): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/transaction-threshold/configure/`,
];

const getPerformanceIssueSettingsQueryKey = (
  orgSlug: string,
  projectSlug: string
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/performance-issues/configure/`];

function ProjectPerformance() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const {
    data: project,
    isPending: isPendingProject,
    isError: isErrorProject,
  } = useDetailedProject({
    projectSlug,
    orgSlug: organization.slug,
  });

  const hasWebVitalsSeerSuggestions = useHasSeerWebVitalsSuggestions(project);

  const {
    data: threshold,
    isPending: isPendingThreshold,
    isError: isErrorThreshold,
  } = useApiQuery<ProjectThreshold>(
    getThresholdQueryKey(organization.slug, projectSlug),
    {
      staleTime: 0,
    }
  );

  const {
    data: performanceIssueSettings,
    isPending: isPendingPerformanceIssueSettings,
    isError: isErrorPerformanceIssueSettings,
  } = useApiQuery<ProjectPerformanceSettings>(
    getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
    {
      staleTime: 0,
    }
  );

  const {
    data: general,
    isPending: isPendingGeneral,
    isError: isErrorGeneral,
  } = useApiQuery<any>(
    [`/projects/${organization.slug}/${projectSlug}/performance/configure/`],
    {
      staleTime: 0,
    }
  );

  const {mutate: resetThresholdSettings, isPending: isPendingResetThresholdSettings} =
    useMutation({
      mutationFn: () => {
        return api.requestPromise(
          `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`,
          {
            method: 'DELETE',
          }
        );
      },
      onMutate: () => {
        trackAnalytics('performance_views.project_transaction_threshold.clear', {
          organization,
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getThresholdQueryKey(organization.slug, projectSlug),
        });
      },
    });

  const {mutate: resetThresholds, isPending: isPendingResetThresholds} = useMutation({
    mutationFn: () => {
      return api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: () => {
      trackAnalytics('performance_views.project_issue_detection_thresholds_reset', {
        organization,
        project_slug: projectSlug,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
      });
    },
  });

  if (
    isPendingThreshold ||
    isPendingPerformanceIssueSettings ||
    isPendingGeneral ||
    isPendingProject ||
    isPendingResetThresholdSettings ||
    isPendingResetThresholds
  ) {
    return (
      <LoadingIndicatorContainer>
        <LoadingIndicator />
      </LoadingIndicatorContainer>
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
  const projectEndpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const performanceIssuesEndpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;
  const isSuperUser = isActiveSuperuser();

  const initialData = {
    metric: threshold?.metric,
    threshold: threshold?.threshold,
  };

  const areAllConfigurationsDisabled = Object.values(DetectorConfigAdmin).every(
    th => !performanceIssueSettings[th]
  );

  const getRetentionPrioritiesData = (...data: any) => {
    return {
      dynamicSamplingBiases: Object.entries(data[1].form).map(([key, value]) => ({
        id: key,
        active: value,
      })),
    };
  };

  function getRetentionPrioritiesFormFields(): Field[] {
    const fields = [
      {
        name: 'boostLatestRelease',
        type: 'boolean' as const,
        label: retentionPrioritiesLabels.boostLatestRelease,
        help: t(
          'Captures more transactions for your new releases as they are being adopted'
        ),
        getData: getRetentionPrioritiesData,
      },
      {
        name: 'boostEnvironments',
        type: 'boolean' as const,
        label: retentionPrioritiesLabels.boostEnvironments,
        help: t(
          'Captures more traces from environments that contain "debug", "dev", "local", "qa", and "test"'
        ),
        getData: getRetentionPrioritiesData,
      },
      {
        name: 'boostLowVolumeTransactions',
        type: 'boolean' as const,
        label: retentionPrioritiesLabels.boostLowVolumeTransactions,
        help: t("Balance high-volume endpoints so they don't drown out low-volume ones"),
        getData: getRetentionPrioritiesData,
      },
      {
        name: 'ignoreHealthChecks',
        type: 'boolean' as const,
        label: retentionPrioritiesLabels.ignoreHealthChecks,
        help: t('Captures fewer of your health checks transactions'),
        getData: getRetentionPrioritiesData,
      },
    ];
    if (
      hasDynamicSamplingCustomFeature(organization) &&
      organization.features.includes('dynamic-sampling-minimum-sample-rate')
    ) {
      fields.push({
        name: 'minimumSampleRate',
        type: 'boolean' as const,
        label: retentionPrioritiesLabels.minimumSampleRate,
        help: t(
          'If higher than the trace sample rate, use the project sample rate for spans instead of the trace sample rate.'
        ),
        getData: getRetentionPrioritiesData,
      });
    }
    return fields;
  }

  const performanceIssueDetectorAdminFieldMapping: Record<string, Field> = {
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
      name: DetectorConfigAdmin.N_PLUS_DB_ENABLED,
      type: 'boolean',
      label: t('N+1 DB Queries Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            n_plus_one_db_queries_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_SLOW_DB_QUERY]: {
      name: DetectorConfigAdmin.SLOW_DB_ENABLED,
      type: 'boolean',
      label: t('Slow DB Queries Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            slow_db_queries_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS]: {
      name: DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED,
      type: 'boolean',
      label: t('N+1 API Calls Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            n_plus_one_api_calls_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET]: {
      name: DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED,
      type: 'boolean',
      label: t('Large Render Blocking Asset Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            large_render_blocking_asset_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: {
      name: DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED,
      type: 'boolean',
      label: t('Consecutive DB Queries Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            consecutive_db_queries_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD]: {
      name: DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED,
      type: 'boolean',
      label: t('Large HTTP Payload Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            large_http_payload_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_DB_MAIN_THREAD]: {
      name: DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED,
      type: 'boolean',
      label: t('DB on Main Thread Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            db_on_main_thread_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
      name: DetectorConfigAdmin.FILE_IO_ENABLED,
      type: 'boolean',
      label: t('File I/O on Main Thread Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            file_io_on_main_thread_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET]: {
      name: DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED,
      type: 'boolean',
      label: t('Uncompressed Assets Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            uncompressed_assets_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP]: {
      name: DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED,
      type: 'boolean',
      label: t('Consecutive HTTP Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            consecutive_http_spans_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.PERFORMANCE_HTTP_OVERHEAD]: {
      name: DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED,
      type: 'boolean',
      label: t('HTTP/1.1 Overhead Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            http_overhead_detection_enabled: value,
          })
        );
      },
    },
    [IssueTitle.QUERY_INJECTION_VULNERABILITY]: {
      name: DetectorConfigAdmin.DB_QUERY_INJECTION_ENABLED,
      type: 'boolean',
      label: t('Potential Database Query Injection Vulnerability Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            db_query_injection_detection_enabled: value,
          })
        );
      },
      visible: organization.features.includes(
        'issue-query-injection-vulnerability-visible'
      ),
    },
    [IssueTitle.WEB_VITALS]: {
      name: DetectorConfigAdmin.WEB_VITALS_ENABLED,
      type: 'boolean',
      label: t('Web Vitals Detection'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            web_vitals_detection_enabled: value,
          })
        );
      },
      visible: hasWebVitalsSeerSuggestions,
    },
  };

  const performanceRegressionAdminFields: Field[] = [
    {
      name: DetectorConfigAdmin.TRANSACTION_DURATION_REGRESSION_ENABLED,
      type: 'boolean',
      label: t('Transaction Duration Regression Enabled'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            transaction_duration_regression_detection_enabled: value,
          })
        );
      },
    },
    {
      name: DetectorConfigAdmin.FUNCTION_DURATION_REGRESSION_ENABLED,
      type: 'boolean',
      label: t('Function Duration Regression Enabled'),
      defaultValue: true,
      onChange: value => {
        setApiQueryData<ProjectPerformanceSettings>(
          queryClient,
          getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
          data => ({
            ...data!,
            function_duration_regression_detection_enabled: value,
          })
        );
      },
    },
  ];

  const project_owner_detector_settings = (hasAccess: boolean): JsonFormObject[] => {
    const disabledText = t('Detection of this issue has been disabled.');

    const disabledReason = hasAccess ? disabledText : null;

    const formatDuration = (value: number | ''): string => {
      return value ? (value < 1000 ? `${value}ms` : `${value / 1000}s`) : '';
    };

    const formatSize = (value: number | ''): string => {
      return value
        ? value < 1000000
          ? `${value / 1000}KB`
          : `${value / 1000000}MB`
        : '';
    };

    const formatFrameRate = (value: number | ''): string => {
      const fps = value && 1000 / value;
      return fps ? `${Math.floor(fps / 5) * 5}fps` : '';
    };

    const formatCount = (value: number | ''): string => {
      return '' + value;
    };

    const issueType = safeGetQsParam('issueType');

    const baseDetectorFields: JsonFormObject[] = [
      {
        title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
        fields: [
          {
            name: DetectorConfigCustomer.N_PLUS_DB_DURATION,
            type: 'range',
            label: t('Minimum Total Duration'),
            defaultValue: 100, // ms
            help: t(
              'Setting the value to 100ms, means that an eligible event will be detected as a N+1 DB Query Issue only if the total duration of the involved spans exceeds 100ms'
            ),
            allowedValues: allowedDurationValues,
            disabled: !(
              hasAccess && performanceIssueSettings[DetectorConfigAdmin.N_PLUS_DB_ENABLED]
            ),
            tickValues: [0, allowedDurationValues.length - 1],
            showTickLabels: true,
            formatLabel: formatDuration,
            flexibleControlStateSize: true,
            disabledReason,
          },
          {
            name: DetectorConfigCustomer.N_PLUS_DB_COUNT,
            type: 'range',
            label: t('Minimum Query Count'),
            defaultValue: 5,
            help: t(
              'Setting the value to 5 means that an eligible event will be detected as an N+1 DB Query Issue only if the number of repeated queries exceeds 5'
            ),
            allowedValues: allowedCountValues,
            disabled: !(
              hasAccess && performanceIssueSettings[DetectorConfigAdmin.N_PLUS_DB_ENABLED]
            ),
            tickValues: [0, allowedCountValues.length - 1],
            showTickLabels: true,
            formatLabel: formatCount,
            flexibleControlStateSize: true,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      },
      {
        title: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
        fields: [
          {
            name: DetectorConfigCustomer.SLOW_DB_DURATION,
            type: 'range',
            label: t('Minimum Duration'),
            defaultValue: 1000, // ms
            help: t(
              'Setting the value to 1s, means that an eligible event will be detected as a Slow DB Query Issue only if the duration of the involved db span exceeds 1s.'
            ),
            tickValues: [0, allowedDurationValues.slice(5).length - 1],
            showTickLabels: true,
            allowedValues: allowedDurationValues.slice(5),
            disabled: !(
              hasAccess && performanceIssueSettings[DetectorConfigAdmin.SLOW_DB_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_SLOW_DB_QUERY,
      },
      {
        title: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
        fields: [
          {
            name: DetectorConfigCustomer.N_PLUS_API_CALLS_DURATION,
            type: 'range',
            label: t('Minimum Total Duration'),
            defaultValue: 300, // ms
            help: t(
              'Setting the value to 300ms, means that an eligible event will be detected as a N+1 API Calls Issue only if the total duration of the involved spans exceeds 300ms'
            ),
            allowedValues: allowedDurationValues.slice(5),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED]
            ),
            tickValues: [0, allowedDurationValues.slice(5).length - 1],
            showTickLabels: true,
            formatLabel: formatDuration,
            flexibleControlStateSize: true,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      },
      {
        title: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
        fields: [
          {
            name: DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO,
            type: 'range',
            label: t('Minimum FCP Ratio'),
            defaultValue: 0.33,
            help: t(
              'Setting the value to 33%, means that an eligible event will be detected as a Large Render Blocking Asset Issue only if the duration of the involved span is at least 33% of First Contentful Paint (FCP).'
            ),
            allowedValues: allowedPercentageValues,
            tickValues: [0, allowedPercentageValues.length - 1],
            showTickLabels: true,
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED]
            ),
            formatLabel: value => value && formatPercentage(value),
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
      },
      {
        title: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
        fields: [
          {
            name: DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_SIZE,
            type: 'range',
            label: t('Minimum Size'),
            defaultValue: 1000000, // 1MB in bytes
            help: t(
              'Setting the value to 1MB, means that an eligible event will be detected as a Large HTTP Payload Issue only if the involved HTTP span has a payload size that exceeds 1MB.'
            ),
            tickValues: [0, allowedSizeValues.slice(1).length - 1],
            showTickLabels: true,
            allowedValues: allowedSizeValues.slice(1),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED]
            ),
            formatLabel: formatSize,
            disabledReason,
          },
          {
            name: DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_FILTERED_PATHS,
            type: 'string',
            label: t('Filtered Paths'),
            placeholder: t('/api/download/, /download/file'),
            help: t(
              'Comma-separated list of URL paths to exclude from Large HTTP Payload detection. Any spans with these paths will be excluded. Supports partial matches (e.g., "/api/" will match "/api/users").'
            ),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED]
            ),
            disabledReason,
            visible: organization.features.includes(
              'large-http-payload-detector-improvements'
            ),
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      },
      {
        title: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
        fields: [
          {
            name: DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION,
            type: 'range',
            label: t('Frame Rate Drop'),
            defaultValue: 16, // ms
            help: t(
              'Setting the value to 60fps, means that an eligible event will be detected as a DB on Main Thread Issue only if database spans on the main thread cause frame rate to drop below 60fps.'
            ),
            tickValues: [0, 3],
            showTickLabels: true,
            allowedValues: [10, 16, 33, 50], // representation of 100 to 20 fps in milliseconds
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED]
            ),
            formatLabel: formatFrameRate,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_DB_MAIN_THREAD,
      },
      {
        title: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
        fields: [
          {
            name: DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION,
            type: 'range',
            label: t('Frame Rate Drop'),
            defaultValue: 16, // ms
            help: t(
              'Setting the value to 60fps, means that an eligible event will be detected as a File I/O on Main Thread Issue only if File I/O spans on the main thread cause frame rate to drop below 60fps.'
            ),
            tickValues: [0, 3],
            showTickLabels: true,
            allowedValues: [10, 16, 33, 50], // representation of 100, 60, 30, 20 fps in milliseconds
            disabled: !(
              hasAccess && performanceIssueSettings[DetectorConfigAdmin.FILE_IO_ENABLED]
            ),
            formatLabel: formatFrameRate,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD,
      },
      {
        title: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
        fields: [
          {
            name: DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED,
            type: 'range',
            label: t('Minimum Time Saved'),
            defaultValue: 100, // ms
            help: t(
              'Setting the value to 100ms, means that an eligible event will be detected as a Consecutive DB Queries Issue only if the time saved by parallelizing the queries exceeds 100ms.'
            ),
            tickValues: [0, allowedDurationValues.slice(0, 23).length - 1],
            showTickLabels: true,
            allowedValues: allowedDurationValues.slice(0, 23),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
      },
      {
        title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
        fields: [
          {
            name: DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE,
            type: 'range',
            label: t('Minimum Size'),
            defaultValue: 512000, // in kilobytes
            help: t(
              'Setting the value to 512KB, means that an eligible event will be detected as an Uncompressed Asset Issue only if the size of the uncompressed asset being transferred exceeds 512KB.'
            ),
            tickValues: [0, allowedSizeValues.slice(1).length - 1],
            showTickLabels: true,
            allowedValues: allowedSizeValues.slice(1),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED]
            ),
            formatLabel: formatSize,
            disabledReason,
          },
          {
            name: DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION,
            type: 'range',
            label: t('Minimum Duration'),
            defaultValue: 500, // in ms
            help: t(
              'Setting the value to 500ms, means that an eligible event will be detected as an Uncompressed Asset Issue only if the duration of the span responsible for transferring the uncompressed asset exceeds 500ms.'
            ),
            tickValues: [0, allowedDurationValues.slice(5).length - 1],
            showTickLabels: true,
            allowedValues: allowedDurationValues.slice(5),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
      },
      {
        title: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
        fields: [
          {
            name: DetectorConfigCustomer.CONSECUTIVE_HTTP_MIN_TIME_SAVED,
            type: 'range',
            label: t('Minimum Time Saved'),
            defaultValue: 2000, // in ms
            help: t(
              'Setting the value to 2s, means that an eligible event will be detected as a Consecutive HTTP Issue only if the time saved by parallelizing the http spans exceeds 2s.'
            ),
            tickValues: [0, allowedDurationValues.slice(14).length - 1],
            showTickLabels: true,
            allowedValues: allowedDurationValues.slice(14),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_HTTP,
      },
      {
        title: IssueTitle.PERFORMANCE_HTTP_OVERHEAD,
        fields: [
          {
            name: DetectorConfigCustomer.HTTP_OVERHEAD_REQUEST_DELAY,
            type: 'range',
            label: t('Request Delay'),
            defaultValue: 500, // in ms
            help: t(
              'Setting the value to 500ms, means that the HTTP request delay (wait time) will have to exceed 500ms for an HTTP Overhead issue to be created.'
            ),
            tickValues: [0, allowedDurationValues.slice(6, 17).length - 1],
            showTickLabels: true,
            allowedValues: allowedDurationValues.slice(6, 17),
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_HTTP_OVERHEAD,
      },
      {
        title: IssueTitle.QUERY_INJECTION_VULNERABILITY,
        fields: [
          {
            name: DetectorConfigCustomer.SQL_INJECTION_QUERY_VALUE_LENGTH,
            type: 'range',
            label: t('SQL Injection Query Value Length'),
            defaultValue: 3,
            help: t(
              'Setting the value to 3, means that the query values with length 3 or more will be assessed when creating a DB Query Injection Vulnerability issue.'
            ),
            tickValues: [3, 10],
            allowedValues: [3, 4, 5, 6, 7, 8, 9, 10],
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.DB_QUERY_INJECTION_ENABLED]
            ),
            formatLabel: value => value && value.toString(),
            disabledReason,
            visible: organization.features.includes(
              'issue-query-injection-vulnerability-visible'
            ),
          },
        ],
        initiallyCollapsed: issueType !== IssueType.QUERY_INJECTION_VULNERABILITY,
      },
      {
        title: IssueTitle.WEB_VITALS,
        fields: [
          {
            name: DetectorConfigCustomer.WEB_VITALS_COUNT,
            type: 'range',
            label: t('Minimum Sample Count'),
            defaultValue: 10,
            help: t(
              'Setting the value to 10, means that web vital issues will only be created if there are at least 10 samples of the web vital type.'
            ),
            tickValues: [0, allowedCountValues.length - 1],
            allowedValues: allowedCountValues,
            showTickLabels: true,
            formatLabel: formatCount,
            flexibleControlStateSize: true,
            disabled: !(
              hasAccess &&
              performanceIssueSettings[DetectorConfigAdmin.WEB_VITALS_ENABLED]
            ),
            disabledReason,
            visible: hasWebVitalsSeerSuggestions,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.WEB_VITALS,
      },
    ];

    // If the organization can manage detectors, add the admin field to the existing settings
    return baseDetectorFields.map(fieldGroup => {
      const manageField =
        performanceIssueDetectorAdminFieldMapping[fieldGroup.title as string];

      return manageField
        ? {
            ...fieldGroup,
            fields: [
              {
                ...manageField,
                help: t(
                  'Controls whether or not Sentry should detect this type of issue.'
                ),
                disabled: !hasAccess,
                disabledReason: t('You do not have permission to manage detectors.'),
              },
              ...fieldGroup.fields,
            ],
          }
        : fieldGroup;
    });
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Performance')} projectSlug={projectSlug} />
      <SettingsPageHeader title={t('Performance')} />
      <ProjectPermissionAlert project={project} />
      <Access access={requiredScopes} project={project}>
        {({hasAccess}) => (
          <Feature features="organizations:insight-modules">
            <Form
              initialData={general}
              saveOnBlur
              apiEndpoint={`/projects/${organization.slug}/${projectSlug}/performance/configure/`}
            >
              <JsonForm
                disabled={!hasAccess}
                fields={[
                  {
                    name: 'enable_images',
                    type: 'boolean',
                    label: t('Images'),
                    help: t('Enables images from real data to be displayed'),
                  },
                ]}
                title={t('General')}
              />
            </Form>
          </Feature>
        )}
      </Access>

      <Form
        saveOnBlur
        allowUndo
        initialData={initialData}
        apiMethod="POST"
        apiEndpoint={`/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`}
        onSubmitSuccess={resp => {
          const initial = initialData;
          const changedThreshold = initial.metric === resp.metric;
          trackAnalytics('performance_views.project_transaction_threshold.change', {
            organization,
            from: changedThreshold ? initial.threshold : initial.metric,
            to: changedThreshold ? resp.threshold : resp.metric,
            key: changedThreshold ? 'threshold' : 'metric',
          });
          setApiQueryData(
            queryClient,
            getThresholdQueryKey(organization.slug, projectSlug),
            resp
          );
        }}
      >
        <Access access={requiredScopes} project={project}>
          {({hasAccess}) => (
            <JsonForm
              title={t('Threshold Settings')}
              fields={formFields}
              disabled={!hasAccess}
              renderFooter={() => (
                <Actions>
                  <Button onClick={() => resetThresholdSettings()}>
                    {t('Reset All')}
                  </Button>
                </Actions>
              )}
            />
          )}
        </Access>
      </Form>
      <Feature features="organizations:dynamic-sampling">
        <Form
          saveOnBlur
          allowUndo
          initialData={
            project.dynamicSamplingBiases?.reduce<Record<string, boolean>>(
              (acc, bias) => {
                acc[bias.id] = bias.active;
                return acc;
              },
              {}
            ) ?? {}
          }
          onSubmitSuccess={(response, _instance, id, change) => {
            ProjectsStore.onUpdateSuccess(response);
            trackAnalytics(
              change?.new === true
                ? 'dynamic_sampling_settings.priority_enabled'
                : 'dynamic_sampling_settings.priority_disabled',
              {
                organization,
                project_id: project.id,
                id: id as DynamicSamplingBiasType,
              }
            );
          }}
          apiMethod="PUT"
          apiEndpoint={projectEndpoint}
        >
          <Access access={requiredScopes} project={project}>
            {({hasAccess}) => (
              <JsonForm
                title={t('Sampling Priorities')}
                fields={getRetentionPrioritiesFormFields()}
                disabled={!hasAccess}
                renderFooter={() => (
                  <Actions>
                    <LinkButton
                      external
                      href="https://docs.sentry.io/product/performance/performance-at-scale/"
                    >
                      {t('Read docs')}
                    </LinkButton>
                  </Actions>
                )}
              />
            )}
          </Access>
        </Form>
      </Feature>
      <Fragment>
        {isSuperUser && (
          <Fragment>
            <Form
              saveOnBlur
              allowUndo
              initialData={performanceIssueSettings}
              apiMethod="PUT"
              onSubmitError={error => {
                if (error.status === 403) {
                  addErrorMessage(
                    t(
                      'This action requires active super user access. Please re-authenticate to make changes.'
                    )
                  );
                }
              }}
              apiEndpoint={performanceIssuesEndpoint}
            >
              <JsonForm
                title={t(
                  '### INTERNAL ONLY ### - Performance Issues Admin Detector Settings'
                )}
                fields={performanceRegressionAdminFields}
                disabled={!isSuperUser}
              />
            </Form>
          </Fragment>
        )}
        <Form
          allowUndo
          initialData={performanceIssueSettings}
          apiMethod="PUT"
          apiEndpoint={performanceIssuesEndpoint}
          saveOnBlur
          onSubmitSuccess={(option: Record<string, number>) => {
            const [threshold_key, threshold_value] = Object.entries(option)[0]!;

            trackAnalytics(
              'performance_views.project_issue_detection_threshold_changed',
              {
                organization,
                project_slug: projectSlug,
                threshold_key,
                threshold_value,
              }
            );
          }}
        >
          <Access access={requiredScopes} project={project}>
            {({hasAccess}) => (
              <div id={projectDetectorSettingsId}>
                <StyledPanelHeader>
                  {t('Performance Issues - Detector Threshold Settings')}
                </StyledPanelHeader>
                <StyledJsonForm
                  forms={project_owner_detector_settings(hasAccess)}
                  collapsible
                />
                <StyledPanelFooter>
                  <Actions>
                    <Confirm
                      message={t(
                        'Are you sure you wish to reset all detector thresholds?'
                      )}
                      onConfirm={() => resetThresholds()}
                      disabled={!hasAccess || areAllConfigurationsDisabled}
                    >
                      <Button>{t('Reset All Thresholds')}</Button>
                    </Confirm>
                  </Actions>
                </StyledPanelFooter>
              </div>
            )}
          </Access>
        </Form>
      </Fragment>
    </Fragment>
  );
}

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

const StyledPanelHeader = styled(PanelHeader)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: none;
`;

const StyledJsonForm = styled(JsonForm)`
  ${Panel} {
    margin-bottom: 0;
    border-radius: 0;
    border-bottom: 0;
  }

  ${FieldWrapper} {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }

  ${FieldWrapper} + ${FieldWrapper} {
    border-top: 0;
  }

  ${Panel} + ${Panel} {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }

  ${PanelHeader} {
    border-bottom: 0;
    text-transform: none;
    margin-bottom: 0;
    background: none;
    padding: ${space(3)} ${space(2)};
  }
`;

const StyledPanelFooter = styled(PanelFooter)`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 0 0 calc(${p => p.theme.radius.md} - 1px)
    calc(${p => p.theme.radius.md} - 1px);

  ${Actions} {
    padding: ${space(1.5)};
  }
`;

const LoadingIndicatorContainer = styled('div')`
  margin: 18px 18px 0;
`;

export default ProjectPerformance;
