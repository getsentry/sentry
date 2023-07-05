import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field, JsonFormObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelFooter, PanelHeader, PanelItem} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {Organization, Project, Scope} from 'sentry/types';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

// These labels need to be exported so that they can be used in audit logs
export const retentionPrioritiesLabels = {
  boostLatestRelease: t('Prioritize new releases'),
  boostEnvironments: t('Prioritize dev environments'),
  boostLowVolumeTransactions: t('Prioritize low-volume transactions'),
  ignoreHealthChecks: t('Deprioritize health checks'),
};

export const allowedDurationValues: number[] = [
  50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
  10000,
]; // In milliseconds

type ProjectPerformanceSettings = {[key: string]: number | boolean};

enum DetectorConfigAdmin {
  N_PLUS_DB_ENABLED = 'n_plus_one_db_queries_detection_enabled',
  SLOW_DB_ENABLED = 'slow_db_queries_detection_enabled',
}

enum DetectorConfigCustomer {
  SLOW_DB_DURATION = 'slow_db_query_duration_threshold',
  N_PLUS_DB_DURATION = 'n_plus_one_db_duration_threshold',
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

    if (organization.features.includes('project-performance-settings-admin')) {
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
      return value && value < 1000 ? `${value}ms` : `${(value as number) / 1000}s`;
    };

    return [
      {
        title: t('N+1 DB Queries'),
        fields: [
          {
            name: DetectorConfigCustomer.N_PLUS_DB_DURATION,
            type: 'range',
            label: t('Duration'),
            defaultValue: 100, // ms
            help: t(
              'Setting the value to 200ms, means that an eligible event will be stored as a N+1 DB Query Issue only if the total duration of the involved spans exceeds 200ms'
            ),
            allowedValues: allowedDurationValues,
            disabled: !(
              hasAccess && performanceSettings[DetectorConfigAdmin.N_PLUS_DB_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
      },
      {
        title: t('Slow DB Queries'),
        fields: [
          {
            name: DetectorConfigCustomer.SLOW_DB_DURATION,
            type: 'range',
            label: t('Duration'),
            defaultValue: 1000, // ms
            help: t(
              'Setting the value to 2s, means that an eligible event will be stored as a Slow DB Query Issue only if the duration of the involved span exceeds 2s.'
            ),
            allowedValues: allowedDurationValues.slice(1),
            disabled: !(
              hasAccess && performanceSettings[DetectorConfigAdmin.SLOW_DB_ENABLED]
            ),
            formatLabel: formatDuration,
            disabledReason,
          },
        ],
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
        <SettingsPageHeader title={t('Performance')} />
        <PermissionAlert project={project} />

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
                  title={t('Retention Priorities')}
                  fields={this.retentionPrioritiesFormFields}
                  disabled={!hasAccess}
                  renderFooter={() => (
                    <Actions>
                      <Button
                        external
                        href="https://docs.sentry.io/product/performance/performance-at-scale/"
                      >
                        {t('Read docs')}
                      </Button>
                    </Actions>
                  )}
                />
              )}
            </Access>
          </Form>
        </Feature>
        <Fragment>
          <Feature features={['organizations:performance-issues-dev']}>
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
          <Feature features={['organizations:project-performance-settings-admin']}>
            {isSuperUser && (
              <Form
                saveOnBlur
                allowUndo
                initialData={this.state.performance_issue_settings}
                apiMethod="PUT"
                apiEndpoint={performanceIssuesEndpoint}
              >
                <JsonForm
                  title={t('Performance Issues - Admin Detector Settings')}
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
                const [threshold_key, threshold_value] = Object.entries(option)[0];

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
                  <div>
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
          </Feature>
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
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.border};
  border-radius: 0 0 calc(${p => p.theme.panelBorderRadius} - 1px)
    calc(${p => p.theme.panelBorderRadius} - 1px);

  ${Actions} {
    padding: ${space(1.5)};
  }
`;

const LoadingIndicatorContainer = styled('div')`
  margin: 18px 18px 0;
`;

export default ProjectPerformance;
