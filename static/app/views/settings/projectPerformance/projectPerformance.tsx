import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';

import {Field} from '../components/forms/type';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type ProjectThreshold = {
  id?: string;
  threshold: string;
  metric: string;
  editedBy?: string;
};

type State = AsyncView['state'] & {
  threshold: ProjectThreshold;
};

class ProjectPerformance extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Performance'), projectId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['threshold', `/projects/${orgId}/${projectId}/transaction-threshold/configure/`],
    ];

    return endpoints;
  }

  handleDelete = () => {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.props;

    this.setState({
      loading: true,
    });

    this.api.request(`/projects/${orgId}/${projectId}/transaction-threshold/configure/`, {
      method: 'DELETE',
      success: () => {
        trackAnalyticsEvent({
          eventKey: 'performance_views.project_transaction_threshold.clear',
          eventName: 'Project Transaction Threshold: Cleared',
          organization_id: organization.id,
        });
      },
      complete: () => this.fetchData(),
    });
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
        choices: [
          ['duration', t('Transaction Duration')],
          ['lcp', t('Largest Contentful Paint')],
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
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Performance')} />
        <PermissionAlert />
        <Form
          saveOnBlur
          allowUndo
          initialData={this.initialData}
          apiMethod="POST"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            const initial = this.initialData;
            const changedThreshold = initial.metric === resp.metric;
            trackAnalyticsEvent({
              eventKey: 'performance_views.project_transaction_threshold.change',
              eventName: 'Project Transaction Threshold: Changed',
              organization_id: organization.id,
              from: changedThreshold ? initial.threshold : initial.metric,
              to: changedThreshold ? resp.threshold : resp.metric,
              key: changedThreshold ? 'threshold' : 'metric',
            });
            this.setState({threshold: resp});
          }}
        >
          <JsonForm
            title={t('General')}
            fields={this.formFields}
            renderFooter={() => (
              <Actions>
                <Button onClick={() => this.handleDelete()}>{t('Reset All')}</Button>
              </Actions>
            )}
          />
        </Form>
      </React.Fragment>
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
