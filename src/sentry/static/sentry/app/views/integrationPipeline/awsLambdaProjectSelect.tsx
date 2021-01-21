import React from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type Props = {projects: Project[]};

export default class AwsLambdaProjectSelect extends React.Component<Props> {
  model = new FormModel();
  render() {
    const {projects} = this.props;
    const formFields: JsonFormObject = {
      title: t('Select a project to use for your AWS Lambda functions'),
      fields: [
        {
          name: 'projectId',
          type: 'sentry_project_selector',
          required: true,
          label: t('Project'),
          inline: false,
          projects,
        },
      ],
    };
    const handleSubmit = ({projectId}: {projectId: string}) => {
      addLoadingMessage(t('Submitting\u2026'));
      this.model.setFormSaving();
      const {
        location: {origin},
      } = window;
      // redirect to the extensions endpoint with the projectId as a query param
      // this is needed so we don't restart the pipeline loading from the original
      // OrganizationIntegrationSetupView route
      const newUrl = `${origin}/extensions/aws_lambda/setup/?projectId=${projectId}`;
      window.location.assign(newUrl);
    };
    // TODO: Add logic if no projects
    return (
      <StyledForm model={this.model} onSubmit={handleSubmit}>
        <JsonForm forms={[formFields]} />
      </StyledForm>
    );
  }
}

const StyledForm = styled(Form)`
  max-width: 500px;
  margin: 50px;
`;
