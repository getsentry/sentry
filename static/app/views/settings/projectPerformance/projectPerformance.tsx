import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelItem} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Organization, Project, Scope} from 'sentry/types';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

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

type State = AsyncView['state'] & {
  threshold: ProjectThreshold;
};

class ProjectPerformance extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Performance'), projectId, false);
  }

  getProjectEndpoint({orgId, projectId}: RouteParams) {
    return `/projects/${orgId}/${projectId}/`;
  }

  getPerformanceIssuesEndpoint({orgId, projectId}: RouteParams) {
    return `/projects/${orgId}/${projectId}/performance-issues/configure/`;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, organization} = this.props;
    const {projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'threshold',
        `/projects/${organization.slug}/${projectId}/transaction-threshold/configure/`,
      ],
      ['project', `/projects/${organization.slug}/${projectId}/`],
    ];

    if (organization.features.includes('performance-issues-dev')) {
      const performanceIssuesEndpoint = [
        'performance_issue_settings',
        `/projects/${organization.slug}/${projectId}/performance-issues/configure/`,
      ] as [string, string];

      endpoints.push(performanceIssuesEndpoint);
    }

    return endpoints;
  }

  getRetentionPrioritiesData(...data) {
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
          trackAdvancedAnalyticsEvent(
            'performance_views.project_transaction_threshold.clear',
            {organization}
          );
        },
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
        name: 'performanceIssueCreationThroughPlatform',
        type: 'boolean',
        label: t('Send Occurrences To Platform'),
        defaultValue: false,
        help: t(
          'This determines whether performance issue occurrences are sent to the issues platform.'
        ),
      },
    ];
  }

  get performanceIssueDetectorsFormFields(): Field[] {
    return [
      {
        name: 'n_plus_one_db_detection_rate',
        type: 'range',
        label: t('N+1 (DB) Detection Rate'),
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultValue: 0,
      },
      {
        name: 'n_plus_one_db_count',
        type: 'number',
        label: t('N+1 (DB) Minimum Count'),
        min: 0,
        max: 1000,
        defaultValue: 5,
      },
      {
        name: 'n_plus_one_db_duration_threshold',
        type: 'number',
        label: t('N+1 (DB) Duration Threshold'),
        min: 0,
        max: 1000000.0,
        defaultValue: 500,
      },
      {
        name: 'n_plus_one_api_calls_detection_rate',
        type: 'range',
        label: t('N+1 API Calls Detection Rate'),
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultValue: 0,
      },
      {
        name: 'consecutive_db_queries_detection_rate',
        type: 'range',
        label: t('Consecutive DB Detection rate'),
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultValue: 0,
      },
    ];
  }

  get retentionPrioritiesFormFields(): Field[] {
    return [
      {
        name: 'boostLatestRelease',
        type: 'boolean',
        label: t('Prioritize new releases'),
        help: t(
          'Captures more transactions for your new releases as they are being adopted'
        ),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'boostEnvironments',
        type: 'boolean',
        label: t('Prioritize dev environments'),
        help: t(
          'Captures more traces from environments that contain "dev", "test", "qa", and "local"'
        ),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'boostKeyTransactions',
        type: 'boolean',
        label: t('Prioritize key transactions'),
        help: t('Captures more of your most important (starred) transactions'),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'boostLowVolumeTransactions',
        type: 'boolean',
        label: t('Prioritize low-volume transactions'),
        help: t("Balance high-volume endpoints so they don't drown out low-volume ones"),
        visible: this.props.organization.features.includes(
          'dynamic-sampling-transaction-name-priority'
        ),
        getData: this.getRetentionPrioritiesData,
      },
      {
        name: 'ignoreHealthChecks',
        type: 'boolean',
        label: t('Deprioritize health checks'),
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

    return (
      <Fragment>
        <SettingsPageHeader title={t('Performance')} />
        <PermissionAlert access={requiredScopes} />
        <Form
          saveOnBlur
          allowUndo
          initialData={this.initialData}
          apiMethod="POST"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            const initial = this.initialData;
            const changedThreshold = initial.metric === resp.metric;
            trackAdvancedAnalyticsEvent(
              'performance_views.project_transaction_threshold.change',
              {
                organization,
                from: changedThreshold ? initial.threshold : initial.metric,
                to: changedThreshold ? resp.threshold : resp.metric,
                key: changedThreshold ? 'threshold' : 'metric',
              }
            );
            this.setState({threshold: resp});
          }}
        >
          <Access access={requiredScopes}>
            {({hasAccess}) => (
              <JsonForm
                title={t('General')}
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
        <Feature features={['organizations:performance-issues-dev']}>
          <Fragment>
            <Form
              saveOnBlur
              allowUndo
              initialData={{
                performanceIssueCreationRate:
                  this.state.project.performanceIssueCreationRate,
              }}
              apiMethod="PUT"
              apiEndpoint={projectEndpoint}
            >
              <Access access={requiredScopes}>
                {({hasAccess}) => (
                  <JsonForm
                    title={t('Performance Issues - All')}
                    fields={this.performanceIssueFormFields}
                    disabled={!hasAccess}
                  />
                )}
              </Access>
            </Form>
            <Form
              saveOnBlur
              allowUndo
              initialData={this.state.performance_issue_settings}
              apiMethod="PUT"
              apiEndpoint={performanceIssuesEndpoint}
            >
              <Access access={requiredScopes}>
                {({hasAccess}) => (
                  <JsonForm
                    title={t('Performance Issues - Detector Settings')}
                    fields={this.performanceIssueDetectorsFormFields}
                    disabled={!hasAccess}
                  />
                )}
              </Access>
            </Form>
          </Fragment>
        </Feature>
        <Feature features={['organizations:dynamic-sampling']}>
          <Form
            saveOnBlur
            allowUndo
            initialData={
              project.dynamicSamplingBiases?.reduce((acc, bias) => {
                acc[bias.id] = bias.active;
                return acc;
              }, {}) ?? {}
            }
            onSubmitSuccess={(_response, _instance, id, change) => {
              trackAdvancedAnalyticsEvent(
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
            <Access access={requiredScopes}>
              {({hasAccess}) => (
                <JsonForm
                  title={t('Retention Priorities')}
                  fields={this.retentionPrioritiesFormFields}
                  disabled={!hasAccess}
                />
              )}
            </Access>
          </Form>
        </Feature>
      </Fragment>
    );
  }
}

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

const LoadingIndicatorContainer = styled('div')`
  margin: 18px 18px 0;
`;

export default ProjectPerformance;
