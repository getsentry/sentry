import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project} from 'app/types';
import StepHeading from 'app/views/onboarding/components/stepHeading';
// import List from 'app/components/list';
// import ListItem from 'app/components/list/listItem';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import SentryProjectSelectorField from 'app/views/settings/components/forms/sentryProjectSelectorField';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

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
    // TODO: Add logic if no projects
    return (
      <Wrapper>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
        <StyledForm model={this.model} hideFooter>
          <StyledStepHeading step={1}>
            {t('Select a project for your AWS Lambda Functions')}
          </StyledStepHeading>
          <StyledSentryProjectSelectorField
            label={t('Select a project')}
            placeholder={t('Select a project')}
            name="projectId"
            projects={projects}
            inline={false}
          />
          <StyledAlert type="info">
            {t('Currently only supports Node runtimes')}
          </StyledAlert>
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
  margin: 100px 50px 50px 50px;
`;

const Wrapper = styled('div')``;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  border-bottom: 0;
`;

const StyledStepHeading = styled(StepHeading)`
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 10px 0 0 0;
`;

const StyledAlert = styled(Alert)`
  margin: ${space(2)};
`;
