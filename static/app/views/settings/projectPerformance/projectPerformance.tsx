import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {Button, LinkButton} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {Field, JsonFormObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Scope} from 'sentry/types/core';
import {IssueTitle, IssueType} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

// These labels need to be exported so that they can be used in audit logs
export const retentionPrioritiesLabels = {
  boostLatestRelease: t('Prioritize new releases'),
  boostEnvironments: t('Prioritize dev environments'),
  boostLowVolumeTransactions: t('Prioritize low-volume transactions'),
  ignoreHealthChecks: t('Deprioritize health checks'),
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

type ProjectPerformanceSettings = {[key: string]: number | boolean};

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
}

export enum DetectorConfigCustomer {
  SLOW_DB_DURATION = 'slow_db_query_duration_threshold',
  N_PLUS_DB_DURATION = 'n_plus_one_db_duration_threshold',
  N_PLUS_DB_COUNT = 'n_plus_one_db_count',
  N_PLUS_API_CALLS_DURATION = 'n_plus_one_api_calls_total_duration_threshold',
  RENDER_BLOCKING_ASSET_RATIO = 'render_blocking_fcp_ratio',
  LARGE_HTT_PAYLOAD_SIZE = 'large_http_payload_size_threshold',
  DB_ON_MAIN_THREAD_DURATION = 'db_on_main_thread_duration_threshold',
  FILE_IO_MAIN_THREAD_DURATION = 'file_io_on_main_thread_duration_threshold',
  UNCOMPRESSED_ASSET_DURATION = 'uncompressed_asset_duration_threshold',
  UNCOMPRESSED_ASSET_SIZE = 'uncompressed_asset_size_threshold',
  CONSECUTIVE_DB_MIN_TIME_SAVED = 'consecutive_db_min_time_saved_threshold',
  CONSECUTIVE_HTTP_MIN_TIME_SAVED = 'consecutive_http_spans_min_time_saved_threshold',
  HTTP_OVERHEAD_REQUEST_DELAY = 'http_request_delay_threshold',
}

type RouteParams = {orgId: string; projectId: string};

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type ProjectThreshold = {
  metric: string;
  threshold: string;
  editedBy?: string;
  id?: string;
};

type State = DeprecatedAsyncComponent['state'] & {
  threshold: ProjectThreshold;
};

class ProjectPerformance extends DeprecatedAsyncComponent<Props, State> {
  getProjectEndpoint({orgId, projectId}: RouteParams) {
    return `/projects/${orgId}/${projectId}/`;
  }

  getPerformanceIssuesEndpoint({orgId, projectId}: RouteParams) {
    return `/projects/${orgId}/${projectId}/performance-issues/configure/`;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {params, organization} = this.props;
    const {projectId} = params;

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [
      [
        'threshold',
        `/projects/${organization.slug}/${projectId}/transaction-threshold/configure/`,
      ],
      ['project', `/projects/${organization.slug}/${projectId}/`],
    ];

    const performanceIssuesEndpoint: ReturnType<
      DeprecatedAsyncComponent['getEndpoints']
    >[number] = [
      'performance_issue_settings',
      `/projects/${organization.slug}/${projectId}/performance-issues/configure/`,
    ];

    const generalSettingsEndpoint: ReturnType<
      DeprecatedAsyncComponent['getEndpoints']
    >[number] = [
      'general',
      `/projects/${organization.slug}/${projectId}/performance/configure/`,
    ];

    endpoints.push(performanceIssuesEndpoint);
    endpoints.push(generalSettingsEndpoint);

    return endpoints;
  }

  getRetentionPrioritiesData(...data: any) {
    return {
      dynamicSamplingBiases: Object.entries(data[1].form).map(([key, value]) => ({
        id: key,
        active: value,
      })),
    };
  }

  handleDelete = () => {
    const {projectId} = this.props.params;
    const {organization} = this.props;

    this.setState({
      loading: true,
    });

    this.api.request(
      `/projects/${organization.slug}/${projectId}/transaction-threshold/configure/`,
      {
        method: 'DELETE',
        success: () => {
          trackAnalytics('performance_views.project_transaction_threshold.clear', {
            organization,
          });
        },
        complete: () => this.fetchData(),
      }
    );
  };

  handleThresholdsReset = () => {
    const {projectId} = this.props.params;
    const {organization, project} = this.props;

    this.setState({
      loading: true,
    });

    trackAnalytics('performance_views.project_issue_detection_thresholds_reset', {
      organization,
      project_slug: project.slug,
    });

    this.api.request(
      `/projects/${organization.slug}/${projectId}/performance-issues/configure/`,
      {
        method: 'DELETE',
        complete: () => this.fetchData(),
      }
    );
  };

  getEmptyMessage() {
    return t('There is no threshold set for this project.');
  }

  renderLoading() {
    return (
      <LoadingIndicatorContainer>
        <LoadingIndicator />
      </LoadingIndicatorContainer>
    );
  }

  get formFields(): Field[] {
    const fields: Field[] = [
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
    return fields;
  }

  get areAllConfigurationsDisabled(): boolean {
    let result = true;
    Object.values(DetectorConfigAdmin).forEach(threshold => {
      result = result && !this.state.performance_issue_settings[threshold];
    });
    return result;
  }

  get performanceIssueFormFields(): Field[] {
    return [
      {
        name: 'performanceIssueCreationRate',
        type: 'range',
        label: t('Performance Issue Creation Rate'),
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultValue: 0,
        help: t(
          'This determines the rate at which performance issues are created. A rate of 0.0 will disable performance issue creation.'
        ),
      },
      {
        name: 'performanceIssueSendToPlatform',
        type: 'boolean',
        label: t('Send Occurrences To Platform'),
        defaultValue: false,
        help: t(
          'This determines whether performance issue occurrences are sent to the issues platform.'
        ),
      },
      {
        name: 'performanceIssueCreationThroughPlatform',
        type: 'boolean',
        label: t('Create Issues Through Issues Platform'),
        defaultValue: false,
        help: t(
          'This determines whether performance issues are created through the issues platform.'
        ),
      },
    ];
  }

  get performanceIssueDetectorAdminFields(): Field[] {
    return [
      {
        name: DetectorConfigAdmin.N_PLUS_DB_ENABLED,
        type: 'boolean',
        label: t('N+1 DB Queries Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              n_plus_one_db_queries_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.SLOW_DB_ENABLED,
        type: 'boolean',
        label: t('Slow DB Queries Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              slow_db_queries_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED,
        type: 'boolean',
        label: t('N+1 API Calls Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              n_plus_one_api_calls_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED,
        type: 'boolean',
        label: t('Large Render Blocking Asset Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              large_render_blocking_asset_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED,
        type: 'boolean',
        label: t('Consecutive DB Queries Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              consecutive_db_queries_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED,
        type: 'boolean',
        label: t('Large HTTP Payload Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              large_http_payload_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED,
        type: 'boolean',
        label: t('DB On Main Thread Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              db_on_main_thread_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.FILE_IO_ENABLED,
        type: 'boolean',
        label: t('File I/O on Main Thread Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              file_io_on_main_thread_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED,
        type: 'boolean',
        label: t('Uncompressed Assets Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              uncompressed_assets_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED,
        type: 'boolean',
        label: t('Consecutive HTTP Detection Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              consecutive_http_spans_detection_enabled: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED,
        type: 'boolean',
        label: t('HTTP/1.1 Overhead Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue_settings,
              [DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED]: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.TRANSACTION_DURATION_REGRESSION_ENABLED,
        type: 'boolean',
        label: t('Transaction Duration Regression Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue__settings,
              [DetectorConfigAdmin.TRANSACTION_DURATION_REGRESSION_ENABLED]: value,
            },
          }),
      },
      {
        name: DetectorConfigAdmin.FUNCTION_DURATION_REGRESSION_ENABLED,
        type: 'boolean',
        label: t('Function Duration Regression Enabled'),
        defaultValue: true,
        onChange: value =>
          this.setState({
            performance_issue_settings: {
              ...this.state.performance_issue__settings,
              [DetectorConfigAdmin.FUNCTION_DURATION_REGRESSION_ENABLED]: value,
            },
          }),
      },
    ];
  }

  project_owner_detector_settings = (hasAccess: boolean): JsonFormObject[] => {
    const performanceSettings: ProjectPerformanceSettings =
      this.state.performance_issue_settings;
    const supportMail = ConfigStore.get('supportEmail');
    const disabledReason = hasAccess
      ? tct(
          'Detection of this issue has been disabled. Contact our support team at [link:support@sentry.io].',
          {
            link: <ExternalLink href={'mailto:' + supportMail} />,
          }
        )
      : null;

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

    return [
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
              hasAccess && performanceSettings[DetectorConfigAdmin.N_PLUS_DB_ENABLED]
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
              hasAccess && performanceSettings[DetectorConfigAdmin.N_PLUS_DB_ENABLED]
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
              hasAccess && performanceSettings[DetectorConfigAdmin.SLOW_DB_ENABLED]
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
              performanceSettings[DetectorConfigAdmin.N_PLUS_ONE_API_CALLS_ENABLED]
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
              performanceSettings[DetectorConfigAdmin.RENDER_BLOCK_ASSET_ENABLED]
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
            name: DetectorConfigCustomer.LARGE_HTT_PAYLOAD_SIZE,
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
              performanceSettings[DetectorConfigAdmin.LARGE_HTTP_PAYLOAD_ENABLED]
            ),
            formatLabel: formatSize,
            disabledReason,
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
              hasAccess && performanceSettings[DetectorConfigAdmin.DB_MAIN_THREAD_ENABLED]
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
              hasAccess && performanceSettings[DetectorConfigAdmin.FILE_IO_ENABLED]
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
              hasAccess && performanceSettings[DetectorConfigAdmin.CONSECUTIVE_DB_ENABLED]
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
              performanceSettings[DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED]
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
              performanceSettings[DetectorConfigAdmin.UNCOMPRESSED_ASSET_ENABLED]
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
              performanceSettings[DetectorConfigAdmin.CONSECUTIVE_HTTP_ENABLED]
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
              hasAccess && performanceSettings[DetectorConfigAdmin.HTTP_OVERHEAD_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
        initiallyCollapsed: issueType !== IssueType.PERFORMANCE_HTTP_OVERHEAD,
      },
    ];
  };

  get retentionPrioritiesFormFields(): Field[] {
    return [
      {
        name: 'boostLatestRelease',
        type: 'boolean',
        label: retentionPrioritiesLabels.boostLatestRelease,
        help: t(
          'Captures more transactions for your new releases as they are being adopted'
        ),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'boostEnvironments',
        type: 'boolean',
        label: retentionPrioritiesLabels.boostEnvironments,
        help: t(
          'Captures more traces from environments that contain "debug", "dev", "local", "qa", and "test"'
        ),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'boostLowVolumeTransactions',
        type: 'boolean',
        label: retentionPrioritiesLabels.boostLowVolumeTransactions,
        help: t("Balance high-volume endpoints so they don't drown out low-volume ones"),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'ignoreHealthChecks',
        type: 'boolean',
        label: retentionPrioritiesLabels.ignoreHealthChecks,
        help: t('Captures fewer of your health checks transactions'),
        getData: this.getRetentionPrioritiesData,
      },
    ];
  }

  get initialData() {
    const {threshold} = this.state;

    return {
      threshold: threshold.threshold,
      metric: threshold.metric,
    };
  }

  renderBody() {
    const {organization, project} = this.props;
    const endpoint = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
    const requiredScopes: Scope[] = ['project:write'];

    const params = {orgId: organization.slug, projectId: project.slug};
    const projectEndpoint = this.getProjectEndpoint(params);
    const performanceIssuesEndpoint = this.getPerformanceIssuesEndpoint(params);
    const isSuperUser = isActiveSuperuser();

    return (
      <Fragment>
        <SentryDocumentTitle title={t('Performance')} projectSlug={project.slug} />
        <SettingsPageHeader title={t('Performance')} />
        <ProjectPermissionAlert margin={false} project={project} />
        <Access access={requiredScopes} project={project}>
          {({hasAccess}) => (
            <Feature features="organizations:insights-initial-modules">
              <Form
                initialData={this.state.general}
                saveOnBlur
                apiEndpoint={`/projects/${organization.slug}/${project.slug}/performance/configure/`}
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
          initialData={this.initialData}
          apiMethod="POST"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            const initial = this.initialData;
            const changedThreshold = initial.metric === resp.metric;
            trackAnalytics('performance_views.project_transaction_threshold.change', {
              organization,
              from: changedThreshold ? initial.threshold : initial.metric,
              to: changedThreshold ? resp.threshold : resp.metric,
              key: changedThreshold ? 'threshold' : 'metric',
            });
            this.setState({threshold: resp});
          }}
        >
          <Access access={requiredScopes} project={project}>
            {({hasAccess}) => (
              <JsonForm
                title={t('Threshold Settings')}
                fields={this.formFields}
                disabled={!hasAccess}
                renderFooter={() => (
                  <Actions>
                    <Button onClick={() => this.handleDelete()}>{t('Reset All')}</Button>
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
                  fields={this.retentionPrioritiesFormFields}
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
          <Feature features="organizations:performance-issues-dev">
            <Form
              saveOnBlur
              allowUndo
              initialData={{
                performanceIssueCreationRate:
                  this.state.project.performanceIssueCreationRate,
                performanceIssueSendToPlatform:
                  this.state.project.performanceIssueSendToPlatform,
                performanceIssueCreationThroughPlatform:
                  this.state.project.performanceIssueCreationThroughPlatform,
              }}
              apiMethod="PUT"
              apiEndpoint={projectEndpoint}
            >
              <Access access={requiredScopes} project={project}>
                {({hasAccess}) => (
                  <JsonForm
                    title={t('Performance Issues - All')}
                    fields={this.performanceIssueFormFields}
                    disabled={!hasAccess}
                  />
                )}
              </Access>
            </Form>
          </Feature>
          {isSuperUser && (
            <Form
              saveOnBlur
              allowUndo
              initialData={this.state.performance_issue_settings}
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
                fields={this.performanceIssueDetectorAdminFields}
                disabled={!isSuperUser}
              />
            </Form>
          )}
          <Form
            allowUndo
            initialData={this.state.performance_issue_settings}
            apiMethod="PUT"
            apiEndpoint={performanceIssuesEndpoint}
            saveOnBlur
            onSubmitSuccess={(option: {[key: string]: number}) => {
              const [threshold_key, threshold_value] = Object.entries(option)[0]!;

              trackAnalytics(
                'performance_views.project_issue_detection_threshold_changed',
                {
                  organization,
                  project_slug: project.slug,
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
                    forms={this.project_owner_detector_settings(hasAccess)}
                    collapsible
                  />
                  <StyledPanelFooter>
                    <Actions>
                      <Confirm
                        message={t(
                          'Are you sure you wish to reset all detector thresholds?'
                        )}
                        onConfirm={() => this.handleThresholdsReset()}
                        disabled={!hasAccess || this.areAllConfigurationsDisabled}
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
}

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

const StyledPanelHeader = styled(PanelHeader)`
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
`;

const StyledJsonForm = styled(JsonForm)`
  ${Panel} {
    margin-bottom: 0;
    border-radius: 0;
    border-bottom: 0;
  }

  ${FieldWrapper} {
    border-top: 1px solid ${p => p.theme.border};
  }

  ${FieldWrapper} + ${FieldWrapper} {
    border-top: 0;
  }

  ${Panel} + ${Panel} {
    border-top: 1px solid ${p => p.theme.border};
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
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 0 0 calc(${p => p.theme.borderRadius} - 1px)
    calc(${p => p.theme.borderRadius} - 1px);

  ${Actions} {
    padding: ${space(1.5)};
  }
`;

const LoadingIndicatorContainer = styled('div')`
  margin: 18px 18px 0;
`;

export default ProjectPerformance;
