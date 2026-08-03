import {z} from 'zod';

import type {SelectValue} from '@sentry/scraps/select';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {AI_DETECTED_ISSUE_TYPES, IssueTitle, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {
  DetectorBooleanField,
  DetectorRangeField,
  DetectorStringField,
  type DetectorBooleanFieldProps,
  type DetectorRangeFieldProps,
  type DetectorStringFieldProps,
} from './detectorFields';

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
export type ProjectPerformanceSettings = Record<string, ProjectPerformanceSettingValue>;

type DetectorDefinition = {
  disabled?: boolean;
  disabledReason?: string | null;
  visible?: boolean;
};

export type DetectorFieldGroup = {
  fields: React.ReactNode[];
  title: string;
  initiallyCollapsed?: boolean;
};

type DetectorBooleanDefinition = Omit<
  DetectorBooleanFieldProps,
  'disabled' | 'endpoint' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {defaultValue: boolean; name: DetectorConfigAdmin};

type DetectorRangeDefinition = Omit<
  DetectorRangeFieldProps,
  'disabled' | 'endpoint' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {defaultValue: number; name: DetectorConfigCustomer};

type DetectorStringDefinition = Omit<
  DetectorStringFieldProps,
  'disabled' | 'endpoint' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {name: DetectorConfigCustomer; defaultValue?: string};

type RetentionPriorityField = {
  hintText: string;
  label: string;
  name: DynamicSamplingBiasType;
};

export enum DetectorConfigAdmin {
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

export type ProjectThreshold = {
  metric: string;
  threshold: string;
  editedBy?: string;
  id?: string;
};

export type GeneralSettings = {enable_images?: boolean};

export const getThresholdQueryOptions = (orgSlug: string, projectSlug: string) =>
  apiOptions.as<ProjectThreshold>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export const getPerformanceIssueSettingsQueryOptions = (
  orgSlug: string,
  projectSlug: string
) =>
  apiOptions.as<ProjectPerformanceSettings>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export const getGeneralSettingsQueryOptions = (orgSlug: string, projectSlug: string) =>
  apiOptions.as<GeneralSettings>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export const generalSettingsSchema = z.object({
  enable_images: z.boolean(),
});

export const thresholdSettingsSchema = z.object({
  metric: z.enum(['duration', 'lcp']).nullable(),
  threshold: z.string(),
});

export type ThresholdMetric = z.infer<typeof thresholdSettingsSchema>['metric'];

export const CALCULATION_METHOD_OPTIONS: Array<SelectValue<ThresholdMetric>> = [
  {value: 'duration', label: t('Transaction Duration')},
  {value: 'lcp', label: t('Largest Contentful Paint')},
];

export const regressionAdminSchema = z.object({
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

export function handleSuperUserError(error: Error) {
  if (error instanceof RequestError && error.status === 403) {
    addErrorMessage(
      t(
        'This action requires active super user access. Please re-authenticate to make changes.'
      )
    );
  }
}

export function getRetentionPriorityFields(
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
  endpoint: string;
  hasAIIssueDetection: boolean;
  hasAccess: boolean;
  hasWebVitalsSeerSuggestions: boolean;
  organization: Organization;
  performanceIssueSettings: ProjectPerformanceSettings;
  projectSlug: string;
  resetVersion: number;
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
>): Record<string, DetectorBooleanDefinition> {
  return {
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
      name: DetectorConfigAdmin.N_PLUS_DB_ENABLED,
      label: t('N+1 DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_SLOW_DB_QUERY]: {
      name: DetectorConfigAdmin.SLOW_DB_ENABLED,
      label: t('Slow DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS]: {
      name: DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED,
      label: t('N+1 API Calls Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET]: {
      name: DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED,
      label: t('Large Render Blocking Asset Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: {
      name: DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED,
      label: t('Consecutive DB Queries Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD]: {
      name: DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED,
      label: t('Large HTTP Payload Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_DB_MAIN_THREAD]: {
      name: DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED,
      label: t('DB on Main Thread Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
      name: DetectorConfigAdmin.FILE_IO_ENABLED,
      label: t('File I/O on Main Thread Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET]: {
      name: DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED,
      label: t('Uncompressed Assets Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP]: {
      name: DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED,
      label: t('Consecutive HTTP Detection'),
      defaultValue: true,
    },
    [IssueTitle.PERFORMANCE_HTTP_OVERHEAD]: {
      name: DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED,
      label: t('HTTP/1.1 Overhead Detection'),
      defaultValue: true,
    },
    [IssueTitle.QUERY_INJECTION_VULNERABILITY]: {
      name: DetectorConfigAdmin.DB_QUERY_INJECTION_ENABLED,
      label: t('Potential Database Query Injection Vulnerability Detection'),
      defaultValue: true,
      visible: organization.features.includes(
        'issue-query-injection-vulnerability-visible'
      ),
    },
    [IssueTitle.WEB_VITALS]: {
      name: DetectorConfigAdmin.WEB_VITALS_ENABLED,
      label: t('Web Vitals Detection'),
      defaultValue: true,
      visible: hasWebVitalsSeerSuggestions,
    },
    ['AI Detected']: {
      name: DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED,
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
export function getProjectDetectorSettings({
  endpoint,
  hasAccess,
  hasAIIssueDetection,
  hasWebVitalsSeerSuggestions,
  organization,
  performanceIssueSettings,
  projectSlug,
  resetVersion,
}: DetectorSettingsOptions): DetectorFieldGroup[] {
  const disabledReason = hasAccess
    ? t('Detection of this issue has been disabled.')
    : null;
  const issueType = safeGetQsParam('issueType');

  const getDisabled = ({disabled, disabledReason: reason}: DetectorDefinition) =>
    disabled ? (reason ?? true) : false;
  const getNumberSetting = (name: DetectorConfigCustomer, defaultValue: number) => {
    const value = performanceIssueSettings[name];
    return typeof value === 'number' ? value : defaultValue;
  };
  const getStringSetting = (name: DetectorConfigCustomer, defaultValue: string) => {
    const value = performanceIssueSettings[name];
    return typeof value === 'string' ? value : defaultValue;
  };
  const booleanField = ({defaultValue, visible, ...props}: DetectorBooleanDefinition) =>
    visible === false ? null : (
      <DetectorBooleanField
        key={`${props.name}-${resetVersion}`}
        {...props}
        disabled={getDisabled(props)}
        endpoint={endpoint}
        initialValue={Boolean(performanceIssueSettings[props.name] ?? defaultValue)}
        projectSlug={projectSlug}
      />
    );
  const rangeField = ({defaultValue, visible, ...props}: DetectorRangeDefinition) =>
    visible === false ? null : (
      <DetectorRangeField
        key={`${props.name}-${resetVersion}`}
        {...props}
        disabled={getDisabled(props)}
        endpoint={endpoint}
        initialValue={getNumberSetting(props.name, defaultValue)}
        projectSlug={projectSlug}
      />
    );
  const stringField = ({
    defaultValue = '',
    visible,
    ...props
  }: DetectorStringDefinition) =>
    visible === false ? null : (
      <DetectorStringField
        key={`${props.name}-${resetVersion}`}
        {...props}
        disabled={getDisabled(props)}
        endpoint={endpoint}
        initialValue={getStringSetting(props.name, defaultValue)}
        projectSlug={projectSlug}
      />
    );

  const baseDetectorFields: DetectorFieldGroup[] = [
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.N_PLUS_DB_DURATION,
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
          disabledReason,
        }),
        rangeField({
          name: DetectorConfigCustomer.N_PLUS_DB_COUNT,
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
          disabledReason,
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    },
    {
      title: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.SLOW_DB_DURATION,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_SLOW_DB_QUERY,
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.N_PLUS_API_CALLS_DURATION,
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
          disabledReason,
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
    },
    {
      title: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
    },
    {
      title: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_SIZE,
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
        }),
        stringField({
          name: DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_FILTERED_PATHS,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD,
    },
    {
      title: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_DB_MAIN_THREAD,
    },
    {
      title: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE,
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
        }),
        rangeField({
          name: DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.CONSECUTIVE_HTTP_MIN_TIME_SAVED,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_HTTP,
    },
    {
      title: IssueTitle.PERFORMANCE_HTTP_OVERHEAD,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.HTTP_OVERHEAD_REQUEST_DELAY,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_HTTP_OVERHEAD,
    },
    {
      title: IssueTitle.QUERY_INJECTION_VULNERABILITY,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.SQL_INJECTION_QUERY_VALUE_LENGTH,
          label: t('SQL Injection Query Value Length'),
          defaultValue: 3,
          help: t(
            'Setting the value to 3, means that the query values with length 3 or more will be assessed when creating a DB Query Injection Vulnerability issue.'
          ),
          tickValues: [0, 7],
          showTickLabels: true,
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
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.QUERY_INJECTION_VULNERABILITY,
    },
    {
      title: IssueTitle.WEB_VITALS,
      fields: [
        rangeField({
          name: DetectorConfigCustomer.WEB_VITALS_COUNT,
          label: t('Minimum Sample Count'),
          defaultValue: 10,
          help: t(
            'Setting the value to 10, means that web vital issues will only be created if there are at least 10 samples of the web vital type.'
          ),
          tickValues: [0, allowedCountValues.length - 1],
          allowedValues: allowedCountValues,
          showTickLabels: true,
          formatLabel: formatCount,
          disabled: !(
            hasAccess && performanceIssueSettings[DetectorConfigAdmin.WEB_VITALS_ENABLED]
          ),
          disabledReason,
          visible: hasWebVitalsSeerSuggestions,
        }),
      ],
      initiallyCollapsed: issueType !== IssueType.WEB_VITALS,
    },
    {
      title: 'AI Detected',
      fields: [
        booleanField({
          name: DetectorConfigAdmin.AI_DETECTED_HTTP_ENABLED,
          label: t('HTTP Issues'),
          help: t('Allow HTTP issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        }),
        booleanField({
          name: DetectorConfigAdmin.AI_DETECTED_DB_ENABLED,
          label: t('Database Issues'),
          help: t('Allow database issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        }),
        booleanField({
          name: DetectorConfigAdmin.AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED,
          label: t('Runtime Performance Issues'),
          help: t('Allow runtime performance issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        }),
        booleanField({
          name: DetectorConfigAdmin.AI_DETECTED_SECURITY_ENABLED,
          label: t('Security Issues'),
          help: t('Allow security issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        }),
        booleanField({
          name: DetectorConfigAdmin.AI_DETECTED_CODE_HEALTH_ENABLED,
          label: t('Code Health Issues'),
          help: t('Allow code health issues to be created'),
          defaultValue: true,
          disabled: !(
            hasAccess &&
            performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
          ),
          disabledReason,
          visible: hasAIIssueDetection,
        }),
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
            booleanField({
              help: t('Controls whether or not Sentry should detect this type of issue.'),
              ...manageField,
              disabled: !hasAccess,
              disabledReason: t('You do not have permission to manage detectors.'),
            }),
            ...fieldGroup.fields,
          ],
        }
      : fieldGroup;
  });
}
