import {t} from 'sentry/locale';
import {AI_DETECTED_ISSUE_TYPES, IssueTitle, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

import {
  DetectorBooleanField,
  type DetectorBooleanFieldProps,
} from './detectorBooleanField';
import {DetectorRangeField, type DetectorRangeFieldProps} from './detectorRangeField';
import {
  DetectorConfigAdmin,
  DetectorConfigCustomer,
  type ProjectPerformanceSettings,
} from './detectorSettings';
import {DetectorStringField, type DetectorStringFieldProps} from './detectorStringField';

const aiDetectedGroupTitle = t('AI Detected');

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
type DetectorDefinition = {
  disabled?: boolean;
  disabledReason?: string | null;
};

export type DetectorFieldGroup = {
  fields: React.ReactNode[];
  title: string;
  initiallyCollapsed?: boolean;
};

type DetectorBooleanDefinition = Omit<
  DetectorBooleanFieldProps,
  'disabled' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {defaultValue: boolean; name: DetectorConfigAdmin};

type DetectorRangeDefinition = Omit<
  DetectorRangeFieldProps,
  'disabled' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {defaultValue: number; name: DetectorConfigCustomer};

type DetectorStringDefinition = Omit<
  DetectorStringFieldProps,
  'disabled' | 'initialValue' | 'projectSlug'
> &
  DetectorDefinition & {name: DetectorConfigCustomer; defaultValue?: string};
const formatDuration = (value: number | ''): string =>
  value ? (value < 1000 ? `${value}ms` : `${value / 1000}s`) : '';

const formatSize = (value: number | ''): string =>
  value ? (value < 1000000 ? `${value / 1000}kB` : `${value / 1000000}MB`) : '';

const formatFrameRate = (value: number | ''): string => {
  const fps = value && 1000 / value;
  return fps ? `${Math.floor(fps / 5) * 5}fps` : '';
};

const formatCount = (value: number | ''): string => '' + value;
type DetectorSettingsOptions = {
  hasAIIssueDetection: boolean;
  hasAccess: boolean;
  hasWebVitalsSeerSuggestions: boolean;
  isResetting: boolean;
  organization: Organization;
  performanceIssueSettings: ProjectPerformanceSettings;
  projectSlug: string;
  resetVersion: number;
};

type DetectorFieldSettings = Pick<
  DetectorSettingsOptions,
  'isResetting' | 'performanceIssueSettings' | 'projectSlug' | 'resetVersion'
>;

function getDisabled(
  {disabled, disabledReason}: DetectorDefinition,
  isResetting: boolean
) {
  if (isResetting) {
    return true;
  }

  return disabled ? (disabledReason ?? true) : false;
}

function BooleanField({
  definition,
  isResetting,
  performanceIssueSettings,
  projectSlug,
  resetVersion,
}: DetectorFieldSettings & {definition: DetectorBooleanDefinition}) {
  const {defaultValue, disabled, disabledReason, ...props} = definition;

  return (
    <DetectorBooleanField
      key={`${props.name}-${resetVersion}`}
      {...props}
      disabled={getDisabled({disabled, disabledReason}, isResetting)}
      initialValue={Boolean(performanceIssueSettings[props.name] ?? defaultValue)}
      projectSlug={projectSlug}
    />
  );
}

function RangeField({
  definition,
  isResetting,
  performanceIssueSettings,
  projectSlug,
  resetVersion,
}: DetectorFieldSettings & {definition: DetectorRangeDefinition}) {
  const {defaultValue, disabled, disabledReason, ...props} = definition;
  const value = performanceIssueSettings[props.name];

  return (
    <DetectorRangeField
      key={`${props.name}-${resetVersion}`}
      {...props}
      disabled={getDisabled({disabled, disabledReason}, isResetting)}
      initialValue={typeof value === 'number' ? value : defaultValue}
      projectSlug={projectSlug}
    />
  );
}

function StringField({
  definition,
  isResetting,
  performanceIssueSettings,
  projectSlug,
  resetVersion,
}: DetectorFieldSettings & {definition: DetectorStringDefinition}) {
  const {defaultValue = '', disabled, disabledReason, ...props} = definition;
  const value = performanceIssueSettings[props.name];

  return (
    <DetectorStringField
      key={`${props.name}-${resetVersion}`}
      {...props}
      disabled={getDisabled({disabled, disabledReason}, isResetting)}
      initialValue={typeof value === 'string' ? value : defaultValue}
      projectSlug={projectSlug}
    />
  );
}

/**
 * Admin-only toggles that turn an entire detector on or off. Keyed by issue
 * title so they can be prepended to the matching customer threshold group.
 */
function getDetectorAdminFields(): Record<string, DetectorBooleanDefinition> {
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
    },
    [IssueTitle.WEB_VITALS]: {
      name: DetectorConfigAdmin.WEB_VITALS_ENABLED,
      label: t('Web Vitals Detection'),
      defaultValue: true,
    },
    [aiDetectedGroupTitle]: {
      name: DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED,
      label: t('AI Issue Detection'),
      help: t('Controls whether or not Sentry runs AI issue detection on your traces.'),
      defaultValue: true,
    },
  };
}

/**
 * Customer-facing threshold groups, one per issue type. Each group is prefixed
 * with its admin enable/disable toggle when one exists.
 */
export function getProjectDetectorSettings({
  hasAccess,
  hasAIIssueDetection,
  hasWebVitalsSeerSuggestions,
  isResetting,
  organization,
  performanceIssueSettings,
  projectSlug,
  resetVersion,
}: DetectorSettingsOptions): DetectorFieldGroup[] {
  const disabledReason = hasAccess
    ? t('Detection of this issue has been disabled.')
    : null;
  const issueType = safeGetQsParam('issueType');
  const fieldSettings = {
    isResetting,
    performanceIssueSettings,
    projectSlug,
    resetVersion,
  };

  const baseDetectorFields: DetectorFieldGroup[] = [
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.N_PLUS_DB_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
        <RangeField
          key={DetectorConfigCustomer.N_PLUS_DB_COUNT}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    },
    {
      title: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.SLOW_DB_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_SLOW_DB_QUERY,
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.N_PLUS_API_CALLS_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
    },
    {
      title: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
    },
    {
      title: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_SIZE}
          {...fieldSettings}
          definition={{
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
          }}
        />,
        <StringField
          key={DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_FILTERED_PATHS}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD,
    },
    {
      title: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_DB_MAIN_THREAD,
    },
    {
      title: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE}
          {...fieldSettings}
          definition={{
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
          }}
        />,
        <RangeField
          key={DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.CONSECUTIVE_HTTP_MIN_TIME_SAVED}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_CONSECUTIVE_HTTP,
    },
    {
      title: IssueTitle.PERFORMANCE_HTTP_OVERHEAD,
      fields: [
        <RangeField
          key={DetectorConfigCustomer.HTTP_OVERHEAD_REQUEST_DELAY}
          {...fieldSettings}
          definition={{
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
          }}
        />,
      ],
      initiallyCollapsed: issueType !== IssueType.PERFORMANCE_HTTP_OVERHEAD,
    },
    {
      title: IssueTitle.QUERY_INJECTION_VULNERABILITY,
      fields: organization.features.includes(
        'issue-query-injection-vulnerability-visible'
      )
        ? [
            <RangeField
              key={DetectorConfigCustomer.SQL_INJECTION_QUERY_VALUE_LENGTH}
              {...fieldSettings}
              definition={{
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
              }}
            />,
          ]
        : [],
      initiallyCollapsed: issueType !== IssueType.QUERY_INJECTION_VULNERABILITY,
    },
    {
      title: IssueTitle.WEB_VITALS,
      fields: hasWebVitalsSeerSuggestions
        ? [
            <RangeField
              key={DetectorConfigCustomer.WEB_VITALS_COUNT}
              {...fieldSettings}
              definition={{
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
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.WEB_VITALS_ENABLED]
                ),
                disabledReason,
              }}
            />,
          ]
        : [],
      initiallyCollapsed: issueType !== IssueType.WEB_VITALS,
    },
    {
      title: aiDetectedGroupTitle,
      fields: hasAIIssueDetection
        ? [
            <BooleanField
              key={DetectorConfigAdmin.AI_DETECTED_HTTP_ENABLED}
              {...fieldSettings}
              definition={{
                name: DetectorConfigAdmin.AI_DETECTED_HTTP_ENABLED,
                label: t('HTTP Issues'),
                help: t('Allow HTTP issues to be created'),
                defaultValue: true,
                disabled: !(
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
                ),
                disabledReason,
              }}
            />,
            <BooleanField
              key={DetectorConfigAdmin.AI_DETECTED_DB_ENABLED}
              {...fieldSettings}
              definition={{
                name: DetectorConfigAdmin.AI_DETECTED_DB_ENABLED,
                label: t('Database Issues'),
                help: t('Allow database issues to be created'),
                defaultValue: true,
                disabled: !(
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
                ),
                disabledReason,
              }}
            />,
            <BooleanField
              key={DetectorConfigAdmin.AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED}
              {...fieldSettings}
              definition={{
                name: DetectorConfigAdmin.AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED,
                label: t('Runtime Performance Issues'),
                help: t('Allow runtime performance issues to be created'),
                defaultValue: true,
                disabled: !(
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
                ),
                disabledReason,
              }}
            />,
            <BooleanField
              key={DetectorConfigAdmin.AI_DETECTED_SECURITY_ENABLED}
              {...fieldSettings}
              definition={{
                name: DetectorConfigAdmin.AI_DETECTED_SECURITY_ENABLED,
                label: t('Security Issues'),
                help: t('Allow security issues to be created'),
                defaultValue: true,
                disabled: !(
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
                ),
                disabledReason,
              }}
            />,
            <BooleanField
              key={DetectorConfigAdmin.AI_DETECTED_CODE_HEALTH_ENABLED}
              {...fieldSettings}
              definition={{
                name: DetectorConfigAdmin.AI_DETECTED_CODE_HEALTH_ENABLED,
                label: t('Code Health Issues'),
                help: t('Allow code health issues to be created'),
                defaultValue: true,
                disabled: !(
                  hasAccess &&
                  performanceIssueSettings[DetectorConfigAdmin.AI_ISSUE_DETECTION_ENABLED]
                ),
                disabledReason,
              }}
            />,
          ]
        : [],
      initiallyCollapsed: !AI_DETECTED_ISSUE_TYPES.has(issueType as IssueType),
    },
  ];

  // If the organization can manage detectors, add the admin field to the existing settings
  const adminFields = getDetectorAdminFields();

  return baseDetectorFields.map(fieldGroup => {
    const manageField = fieldGroup.fields.length
      ? adminFields[fieldGroup.title]
      : undefined;

    return manageField
      ? {
          ...fieldGroup,
          fields: [
            <BooleanField
              key={manageField.name}
              {...fieldSettings}
              definition={{
                help: t(
                  'Controls whether or not Sentry should detect this type of issue.'
                ),
                ...manageField,
                disabled: !hasAccess,
                disabledReason: t('You do not have permission to manage detectors.'),
              }}
            />,
            ...fieldGroup.fields,
          ],
        }
      : fieldGroup;
  });
}
