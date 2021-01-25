import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import Alert from 'app/components/alert';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project} from 'app/types';
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
      <React.Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
        <StyledList symbol="colored-numeric">
          <React.Fragment />
          <ListItem>
            <h4>{t('Select a project for your AWS Lambdas')}</h4>
            <Form model={this.model} hideFooter>
              <StyledSentryProjectSelectorField
                placeholder={t('Select a project')}
                name="projectId"
                projects={projects}
                inline={false}
                hasControlState
                flexibleControlStateSize
                stacked
              />
              <Alert type="info">{t('Currently only supports Node runtimes')}</Alert>
            </Form>
          </ListItem>
        </StyledList>
        <Observer>
          {() => (
            <FooterWithButtons
              buttonText={t('Next')}
              onClick={this.handleSubmit}
              disabled={this.model.isSaving || !this.model.getValue('projectId')}
            />
          )}
        </Observer>
      </React.Fragment>
    );
  }
}

const StyledList = styled(List)`
  margin: 100px 50px 50px 50px;
`;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  padding: 0 0 ${space(2)} 0;
`;
