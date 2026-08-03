import {Fragment} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {SelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Scope} from 'sentry/types/core';
import {AI_DETECTED_ISSUE_TYPES, IssueTitle, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject, Project} from 'sentry/types/project';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation, setApiQueryData} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
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

type ProjectPerformanceSettingValue = boolean | number | string;
type ProjectPerformanceSettings = Record<string, ProjectPerformanceSettingValue>;

type DetectorFieldConfig = {
  label: string;
  name: DetectorConfigAdmin | DetectorConfigCustomer;
  type: 'boolean' | 'range' | 'string';
  allowedValues?: readonly number[];
  defaultValue?: ProjectPerformanceSettingValue;
  disabled?: boolean;
  disabledReason?: string | null;
  flexibleControlStateSize?: boolean;
  formatLabel?: (value: number | '') => React.ReactNode;
  help?: string;
  placeholder?: string;
  showTickLabels?: boolean;
  tickValues?: number[];
  visible?: boolean;
};

type DetectorFieldGroup = {
  fields: DetectorFieldConfig[];
  title: string;
  initiallyCollapsed?: boolean;
};

type RetentionPriorityField = {
  hintText: string;
  label: string;
  name: DynamicSamplingBiasType;
};

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
  AI_ISSUE_DETECTION_ENABLED = 'ai_issue_detection_enabled',
  AI_DETECTED_HTTP_ENABLED = 'ai_detected_http_enabled',
  AI_DETECTED_DB_ENABLED = 'ai_detected_db_enabled',
  AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED = 'ai_detected_runtime_performance_enabled',
  AI_DETECTED_SECURITY_ENABLED = 'ai_detected_security_enabled',
  AI_DETECTED_CODE_HEALTH_ENABLED = 'ai_detected_code_health_enabled',
  AI_DETECTED_GENERAL_ENABLED = 'ai_detected_general_enabled',
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

type GeneralSettings = {enable_images?: boolean};

const getThresholdQueryKey = (orgSlug: string, projectSlug: string): ApiQueryKey => [
  getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
    }
  ),
];

const getPerformanceIssueSettingsQueryKey = (
  orgSlug: string,
  projectSlug: string
): ApiQueryKey => [
  getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
    }
  ),
];

const getGeneralSettingsQueryKey = (
  orgSlug: string,
  projectSlug: string
): ApiQueryKey => [
  getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/performance/configure/', {
    path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
  }),
];

const generalSettingsSchema = z.object({
  enable_images: z.boolean(),
});

const thresholdSettingsSchema = z.object({
  metric: z.enum(['duration', 'lcp']).nullable(),
  threshold: z.string(),
});

type ThresholdMetric = z.infer<typeof thresholdSettingsSchema>['metric'];

const CALCULATION_METHOD_OPTIONS: Array<SelectValue<ThresholdMetric>> = [
  {value: 'duration', label: t('Transaction Duration')},
  {value: 'lcp', label: t('Largest Contentful Paint')},
];

const regressionAdminSchema = z.object({
  transaction_duration_regression_detection_enabled: z.boolean(),
  function_duration_regression_detection_enabled: z.boolean(),
});

const formatDuration = (value: number | ''): string =>
  value ? (value < 1000 ? `${value}ms` : `${value / 1000}s`) : '';

const formatSize = (value: number | ''): string =>
  value ? (value < 1000000 ? `${value / 1000}kB` : `${value / 1000000}MB`) : '';

const formatFrameRate = (value: number | ''): string => {
  const fps = value && 1000 / value;
  return fps ? `${Math.floor(fps / 5) * 5}fps` : '';
};

const formatCount = (value: number | ''): string => '' + value;

function handleSuperUserError(error: Error) {
  if (error instanceof RequestError && error.status === 403) {
    addErrorMessage(
      t(
        'This action requires active super user access. Please re-authenticate to make changes.'
      )
    );
  }
}

function getRetentionPriorityFields(
  organization: Organization
): RetentionPriorityField[] {
  return [
    {
      name: DynamicSamplingBiasType.BOOST_LATEST_RELEASES,
      label: retentionPrioritiesLabels.boostLatestRelease,
      hintText: t(
        'Captures more transactions for your new releases as they are being adopted'
      ),
    },
    {
      name: DynamicSamplingBiasType.BOOST_ENVIRONMENTS,
      label: retentionPrioritiesLabels.boostEnvironments,
      hintText: t(
        'Captures more traces from environments that contain "debug", "dev", "local", "qa", and "test"'
      ),
    },
    {
      name: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS,
      label: retentionPrioritiesLabels.boostLowVolumeTransactions,
      hintText: t(
        "Balance high-volume endpoints so they don't drown out low-volume ones"
      ),
    },
    {
      name: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS,
      label: retentionPrioritiesLabels.ignoreHealthChecks,
      hintText: t('Captures fewer of your health checks transactions'),
    },
    ...(hasDynamicSamplingCustomFeature(organization) &&
    organization.features.includes('dynamic-sampling-minimum-sample-rate')
      ? [
          {
            name: DynamicSamplingBiasType.MINIMUM_SAMPLE_RATE,
            label: retentionPrioritiesLabels.minimumSampleRate,
            hintText: t(
              'If higher than the trace sample rate, use the project sample rate for spans instead of the trace sample rate.'
            ),
          },
        ]
      : []),
  ];
}

type DetectorSettingsOptions = {
  hasAIIssueDetection: boolean;
  hasAccess: boolean;
  hasWebVitalsSeerSuggestions: boolean;
  organization: Organization;
  performanceIssueSettings: ProjectPerformanceSettings;
};

/**
 * Admin-only toggles that turn an entire detector on or off. Keyed by issue
 * title so they can be prepended to the matching customer threshold group.
 */
function getDetectorAdminFields({
  hasAIIssueDetection,
  hasWebVitalsSeerSuggestions,
  organization,
}: Pick<
  DetectorSettingsOptions,
  'hasAIIssueDetection' | 'hasWebVitalsSeerSuggestions' | 'organization'
>): Record<string, DetectorFieldConfig> {
  return {
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
      name: DetectorConfigAdmin.N_PLUS_DB_ENABLED,
      type: 'boolean',
      label: t('N+1 DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_SLOW_DB_QUERY]: {
      name: DetectorConfigAdmin.SLOW_DB_ENABLED,
      type: 'boolean',
      label: t('Slow DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS]: {
      name: DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED,
      type: 'boolean',
      label: t('N+1 API Calls Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET]: {
      name: DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED,
      type: 'boolean',
      label: t('Large Render Blocking Asset Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: {
      name: DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED,
      type: 'boolean',
      label: t('Consecutive DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD]: {
      name: DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED,
      type: 'boolean',
      label: t('Large HTTP Payload Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_DB_MAIN_THREAD]: {
      name: DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED,
      type: 'boolean',
      label: t('DB on Main Thread Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
      name: DetectorConfigAdmin.FILE_IO_ENABLED,
      type: 'boolean',
      label: t('File I/O on Main Thread Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET]: {
      name: DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED,
      type: 'boolean',
      label: t('Uncompressed Assets Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP]: {
      name: DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED,
      type: 'boolean',
      label: t('Consecutive HTTP Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_HTTP_OVERHEAD]: {
      name: DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED,
      type: 'boolean',
      label: t('HTTP/1.1 Overhead Detection'),
      defaultValue: true,
    },
    [IssueTitle.QUERY_INJECTION_VULNERABILITY]: {
      name: DetectorConfigAdmin.DB_QUERY_INJECTION_ENABLED,
      type: 'boolean',
      label: t('Potential Database Query Injection Vulnerability Detection'),
      defaultValue: true,
      visible: organization.features.includes(
        'issue-query-injection-vulnerability-visible'
      ),
    },
    [IssueTitle.WEB_VITALS]: {
      name: DetectorConfigAdmin.WEB_VITALS_ENABLED,
      type: 'boolean',
      label: t('Web Vitals Detection'),
      defaultValue: true,
      visible: hasWebVitalsSeerSuggestions,
    },
    ['AI Detected']: {
      name: DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED,
      type: 'boolean',
      label: t('AI Issue Detection'),
      help: t('Controls whether or not Sentry runs AI issue detection on your traces.'),
      defaultValue: true,
      visible: hasAIIssueDetection,
    },
  };
}

/**
 * Customer-facing threshold groups, one per issue type. Each group is prefixed
 * with its admin enable/disable toggle when one exists.
 */
function getProjectDetectorSettings({
  hasAccess,
  hasAIIssueDetection,
  hasWebVitalsSeerSuggestions,
  organization,
  performanceIssueSettings,
}: DetectorSettingsOptions): DetectorFieldGroup[] {
  const disabledReason = hasAccess
    ? t('Detection of this issue has been disabled.')
    : null;
  const issueType = safeGetQsParam('issueType');

  const baseDetectorFields: DetectorFieldGroup[] = [
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
          visible: true,
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
            hasAccess && performanceIssueSettings[DetectorConfigAdmin.WEB_VITALS_ENABLED]
          ),
          disabledReason,
          visible: hasWebVitalsSeerSuggestions,
        },
      ],
      initiallyCollapsed: issueType !== IssueType.WEB_VITALS,
    },
    {
      title: 'AI Detected',
      fields: [
        {
          name: DetectorConfigAdmin.AI_DETECTED_HTTP_ENABLED,
          type: 'boolean',
          label: t('HTTP Issues'),
          help: t('Allow HTTP issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        },
        {
          name: DetectorConfigAdmin.AI_DETECTED_DB_ENABLED,
          type: 'boolean',
          label: t('Database Issues'),
          help: t('Allow database issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        },
        {
          name: DetectorConfigAdmin.AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED,
          type: 'boolean',
          label: t('Runtime Performance Issues'),
          help: t('Allow runtime performance issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        },
        {
          name: DetectorConfigAdmin.AI_DETECTED_SECURITY_ENABLED,
          type: 'boolean',
          label: t('Security Issues'),
          help: t('Allow security issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        },
        {
          name: DetectorConfigAdmin.AI_DETECTED_CODE_HEALTH_ENABLED,
          type: 'boolean',
          label: t('Code Health Issues'),
          help: t('Allow code health issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        },
      ],
      initiallyCollapsed: !AI_DETECTED_ISSUE_TYPES.has(issueType as IssueType),
    },
  ];

  // If the organization can manage detectors, add the admin field to the existing settings
  const adminFields = getDetectorAdminFields({
    hasAIIssueDetection,
    hasWebVitalsSeerSuggestions,
    organization,
  });

  return baseDetectorFields.map(fieldGroup => {
    const manageField = adminFields[fieldGroup.title];

    return manageField
      ? {
          ...fieldGroup,
          fields: [
            {
              help: t('Controls whether or not Sentry should detect this type of issue.'),
              ...manageField,
              disabled: !hasAccess,
              disabledReason: t('You do not have permission to manage detectors.'),
            },
            ...fieldGroup.fields,
          ],
        }
      : fieldGroup;
  });
}

function useDetectorFieldMutationOptions(endpoint: string, projectSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return {
    mutationFn: (data: ProjectPerformanceSettings) =>
      fetchMutation<ProjectPerformanceSettings>({url: endpoint, method: 'PUT', data}),
    onSuccess: (
      _data: ProjectPerformanceSettings,
      variables: ProjectPerformanceSettings
    ) => {
      setApiQueryData<ProjectPerformanceSettings>(
        queryClient,
        getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
        previous => ({...previous, ...variables})
      );

      const [thresholdKey, thresholdValue] = Object.entries(variables)[0] ?? [];
      if (thresholdKey && typeof thresholdValue === 'number') {
        trackAnalytics('performance_views.project_issue_detection_threshold_changed', {
          organization,
          project_slug: projectSlug,
          threshold_key: thresholdKey,
          threshold_value: thresholdValue,
        });
      }
    },
  };
}

type DetectorFieldProps<TValue> = {
  disabled: boolean | string;
  field: DetectorFieldConfig;
  initialValue: TValue;
  mutationOptions: ReturnType<typeof useDetectorFieldMutationOptions>;
};

function DetectorBooleanField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<boolean>) {
  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.boolean()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => (
        <formField.Layout.Row label={field.label} hintText={field.help}>
          <formField.Switch
            checked={formField.state.value}
            onChange={formField.handleChange}
            disabled={disabled}
          />
        </formField.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

function DetectorStringField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<string>) {
  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.string()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => (
        <formField.Layout.Row label={field.label} hintText={field.help}>
          <formField.Input
            value={formField.state.value}
            onChange={formField.handleChange}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </formField.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

/**
 * The slider is indexed against `allowedValues` rather than bound to the raw
 * threshold, so only the sanctioned steps are reachable.
 */
function DetectorRangeField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<number>) {
  const allowedValues = field.allowedValues ?? [];

  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.number()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => {
        const valueIndex = Math.max(allowedValues.indexOf(formField.state.value), 0);
        const formattedValue = field.formatLabel?.(formField.state.value);

        return (
          <formField.Layout.Row label={field.label} hintText={field.help}>
            <Stack flexGrow={1} gap="xs">
              <formField.Range
                aria-label={field.label}
                value={valueIndex}
                onChange={index => {
                  const value = allowedValues[index];
                  if (value !== undefined) {
                    formField.handleChange(value);
                  }
                }}
                min={0}
                max={Math.max(allowedValues.length - 1, 0)}
                step={1}
                ticks={
                  field.tickValues
                    ? {values: field.tickValues, labels: field.showTickLabels}
                    : undefined
                }
                formatOptions="hidden"
                aria-valuetext={
                  typeof formattedValue === 'string' ? formattedValue : undefined
                }
                disabled={disabled}
              />
              <Text align="right" size="sm" variant="muted">
                {formattedValue ?? formField.state.value}
              </Text>
            </Stack>
          </formField.Layout.Row>
        );
      }}
    </AutoSaveForm>
  );
}

function DetectorAutoSaveField({
  endpoint,
  field,
  initialValue,
  projectSlug,
}: {
  endpoint: string;
  field: DetectorFieldConfig;
  initialValue: ProjectPerformanceSettingValue;
  projectSlug: string;
}) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);

  if (field.visible === false) {
    return null;
  }

  const disabled = field.disabled ? (field.disabledReason ?? true) : false;

  if (field.type === 'boolean') {
    return (
      <DetectorBooleanField
        field={field}
        initialValue={Boolean(initialValue)}
        disabled={disabled}
        mutationOptions={mutationOptions}
      />
    );
  }

  if (field.type === 'string') {
    return (
      <DetectorStringField
        field={field}
        initialValue={typeof initialValue === 'string' ? initialValue : ''}
        disabled={disabled}
        mutationOptions={mutationOptions}
      />
    );
  }

  return (
    <DetectorRangeField
      field={field}
      initialValue={
        typeof initialValue === 'number' ? initialValue : Number(field.defaultValue)
      }
      disabled={disabled}
      mutationOptions={mutationOptions}
    />
  );
}

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
              setApiQueryData<GeneralSettings>(
                queryClient,
                getGeneralSettingsQueryKey(organization.slug, projectSlug),
                prev => ({...prev, enable_images: variables.enable_images})
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
  threshold,
}: {
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  threshold: ProjectThreshold;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;

  const cacheThreshold = (data: ProjectThreshold) =>
    setApiQueryData(
      queryClient,
      getThresholdQueryKey(organization.slug, projectSlug),
      data
    );

  return (
    <FieldGroup title={t('Threshold Settings')}>
      <AutoSaveForm
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
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const priorityFields = getRetentionPriorityFields(organization);

  const isPriorityActive = (name: DynamicSamplingBiasType) =>
    project.dynamicSamplingBiases?.find(bias => bias.id === name)?.active ?? false;

  return (
    <Feature features="organizations:dynamic-sampling">
      <FieldGroup title={t('Sampling Priorities')}>
        {priorityFields.map(priority => (
          <AutoSaveForm
            key={priority.name}
            name={priority.name}
            schema={z.object({[priority.name]: z.boolean()})}
            initialValue={isPriorityActive(priority.name)}
            mutationOptions={{
              mutationFn: (data: Record<string, boolean>) =>
                fetchMutation<Project>({
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
                  disabled={!hasWriteAccess}
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
    setApiQueryData<ProjectPerformanceSettings>(
      queryClient,
      getPerformanceIssueSettingsQueryKey(organization.slug, projectSlug),
      prev => ({...prev, ...setting})
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
}: {
  detectorGroups: DetectorFieldGroup[];
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  performanceIssueSettings: ProjectPerformanceSettings;
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
        {detectorGroups.map(group => (
          <Disclosure key={group.title} defaultExpanded={!group.initiallyCollapsed}>
            <Disclosure.Title>{group.title}</Disclosure.Title>
            <Disclosure.Content>
              <Stack gap="sm">
                {group.fields.map(field => (
                  <DetectorAutoSaveField
                    key={field.name}
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

  const thresholdEndpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;
  const performanceIssuesEndpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;

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
  } = useQuery(
    apiOptions.as<ProjectThreshold>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
        staleTime: 0,
      }
    )
  );

  const {
    data: performanceIssueSettings,
    isPending: isPendingPerformanceIssueSettings,
    isError: isErrorPerformanceIssueSettings,
  } = useQuery(
    apiOptions.as<ProjectPerformanceSettings>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
        staleTime: 0,
      }
    )
  );

  const {
    data: general,
    isPending: isPendingGeneral,
    isError: isErrorGeneral,
  } = useQuery(
    apiOptions.as<GeneralSettings>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance/configure/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
        staleTime: 0,
      }
    )
  );

  const {mutate: resetThresholdSettings, isPending: isPendingResetThresholdSettings} =
    useMutation({
      mutationFn: () => fetchMutation({url: thresholdEndpoint, method: 'DELETE'}),
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
    mutationFn: () => fetchMutation({url: performanceIssuesEndpoint, method: 'DELETE'}),
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
      />
    </Fragment>
  );
}
