import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type Props = {
  projects: Project[];
};

export default class AwsLambdaProjectSelect extends React.Component<Props> {
  get formFields(): JsonFormObject {
    const {projects} = this.props;
    return {
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
  }
  handleSubmit = ({projectId}: {projectId: string}) => {
    // redirect to the same URL but with the project_id set
    const {
      location: {origin, pathname},
    } = window;
    const newUrl = `${origin}${pathname}?project_id=${projectId}`;
    window.location.replace(newUrl);
  };
  render() {
    return (
      <StyledForm onSubmit={this.handleSubmit}>
        <JsonForm forms={[this.formFields]} />
      </StyledForm>
    );
  }
}

const StyledForm = styled(Form)`
  max-width: 500px;
  margin: 50px;
`;
