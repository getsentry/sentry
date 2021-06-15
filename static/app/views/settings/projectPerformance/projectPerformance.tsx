import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

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

    this.setState({
      loading: true,
    });

    this.api.request(`/projects/${orgId}/${projectId}/transaction-threshold/configure/`, {
      method: 'DELETE',
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
    const fields: any[] = [
      {
        name: 'threshold',
        type: 'string',
        label: t('Response Time Threshold'),
        placeholder: t('300'),
        help: t(
          'Set a response time threshold to help define what satisfactory and tolerable times are. These will be reflected in the calculation of your Apdex, a standard measurement in performance monitoring and the User Misery score. You can customize this per project.'
        ),
      },
      {
        name: 'metric',
        type: 'select',
        label: t('Metric'),
        choices: () => ['duration', 'lcp'],
        help: t(
          'Set the measurement to apply the Response Time Threshold to. This metric will be used to calculate the Apdex and User Misery Scores.'
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
        <Form
          saveOnBlur
          allowUndo
          initialData={this.initialData}
          apiMethod="POST"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            this.setState({threshold: resp});
          }}
        >
          <JsonForm
            title={t('General')}
            fields={this.formFields}
            renderFooter={() => (
              <Actions>
                <Button onClick={() => this.handleDelete()}>
                  {t('Clear Custom Threshold')}
                </Button>
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
