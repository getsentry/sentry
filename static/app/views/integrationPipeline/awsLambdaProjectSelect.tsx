import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/alert';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

type Props = {projects: Project[]};

export default class AwsLambdaProjectSelect extends Component<Props> {
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
      <Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/" />
        <StyledList symbol="colored-numeric">
          <Fragment />
          <ListItem>
            <h3>{t('Select a project for your AWS Lambdas')}</h3>
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
              <Alert.Container>
                <Alert margin type="info">
                  {t('Currently only supports Node and Python Lambda functions')}
                </Alert>
              </Alert.Container>
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
      </Fragment>
    );
  }
}

const StyledList = styled(List)`
  padding: 100px 50px 50px 50px;
`;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  padding: 0 0 ${space(2)} 0;
`;
