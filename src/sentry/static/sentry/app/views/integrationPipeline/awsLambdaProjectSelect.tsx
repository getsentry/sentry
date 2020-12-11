import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

export default function AwsLambdaProjectSelect({projects}: {projects: Project[]}) {
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
    // redirect to the same URL but with the project_id set
    const {
      location: {origin, pathname},
    } = window;
    const newUrl = `${origin}${pathname}?project_id=${projectId}`;
    window.location.replace(newUrl);
  };
  return (
    <StyledForm onSubmit={handleSubmit}>
      <JsonForm forms={[formFields]} />
    </StyledForm>
  );
}

const StyledForm = styled(Form)`
  max-width: 500px;
  margin: 50px;
`;
