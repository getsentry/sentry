import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

import FooterWithButtons from './components/footerWithButtons';

type Props = {projects: Project[]};

export default class AwsLambdaProjectSelect extends React.Component<Props> {
  model = new FormModel();
  handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    const data = this.model.getData();
    addLoadingMessage(t('Submitting\u2026'));
    this.model.setFormSaving();
    const {
      location: {origin},
    } = window;
    // redirect to the extensions endpoint with the form fields as query params
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const newUrl = `${origin}/extensions/aws_lambda/setup/?${qs.stringify(data)}`;
    window.location.assign(newUrl);
  };
  render() {
    const {projects} = this.props;
    const formFields: JsonFormObject = {
      title: t('Select a project to use for your AWS Lambda functions'),
      fields: [
        {
          name: 'projectId',
          type: 'sentry_project_selector',
          required: true,
          label: t('Select a project'),
          inline: false,
          projects,
        },
      ],
    };
    // TODO: Add logic if no projects
    return (
      <Wrapper>
        <StyledForm model={this.model} hideFooter>
          <JsonForm forms={[formFields]} />
        </StyledForm>
        <Observer>
          {() => (
            <FooterWithButtons
              buttonText={t('Next')}
              onClick={this.handleSubmit}
              disabled={this.model.isSaving || !this.model.getValue('projectId')}
            />
          )}
        </Observer>
      </Wrapper>
    );
  }
}

const StyledForm = styled(Form)`
  max-width: 500px;
  margin: 50px;
`;

const Wrapper = styled('div')``;
