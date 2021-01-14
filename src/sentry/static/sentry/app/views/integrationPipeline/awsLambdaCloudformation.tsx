import React from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

// let the browser generate and store the external ID
// this way the same user always has the same external ID if they restart the pipeline
const ID_NAME = 'AWS_EXTERNAL_ID';
const getAwsExternalId = () => {
  let awsExternalId = window.localStorage.getItem(ID_NAME);
  if (!awsExternalId) {
    awsExternalId = uniqueId();
    window.localStorage.setItem(ID_NAME, awsExternalId);
  }
  return awsExternalId;
};

type Props = {
  baseCloudformationUrl: string;
  templateUrl: string;
  stackName: string;
  arn?: string;
  error?: string;
};

export default class AwsLambdaCloudformation extends React.Component<Props> {
  componentDidMount() {
    // show the error if we have it
    const {error} = this.props;
    if (error) {
      addErrorMessage(error, {duration: 10000});
    }
  }
  model = new FormModel();
  get initialData() {
    const {arn} = this.props;
    const awsExternalId = getAwsExternalId();
    return {
      awsExternalId,
      arn,
    };
  }
  get cloudformationUrl() {
    // generarate the cloudformation URL using the params we get from the server
    // and the external id we generate
    const {baseCloudformationUrl, templateUrl, stackName} = this.props;
    const awsExternalId = getAwsExternalId();
    const query = qs.stringify({
      templateURL: templateUrl,
      stackName,
      param_ExternalId: awsExternalId,
    });
    return `${baseCloudformationUrl}?${query}`;
  }
  handleSubmit = (data: any) => {
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
  renderFormHeader = () => {
    const cloudformationUrl = this.cloudformationUrl;
    const acklowedgeResource = (
      <strong>
        {t('I Acknowledge that AWS CloudFormation might create IAM resources')}
      </strong>
    );
    const create = <strong>{t('Create')}</strong>;
    const arnStrong = <strong>ARN</strong>;
    const sentryMonitoringStack = <strong>SentryMonitoringStack</strong>;
    return (
      <InstructionWrapper>
        <ol>
          <li>
            <ExternalLink href={cloudformationUrl}>
              {t("Add Sentry's Cloudfromation stack to your AWS")}
            </ExternalLink>
          </li>
          <li>
            {tct('Mark "[acklowedgeResource]"', {
              acklowedgeResource,
            })}
          </li>
          <li>
            {tct('Press "[create]"', {
              create,
            })}
          </li>
          <li>
            {tct(
              'It might take a minute or two for the CloudFormation stack to set up. Find the stack in list of stacks and copy the "[arnStrong]" value of "[sentryMonitoringStack]" into the input below:',
              {
                arnStrong,
                sentryMonitoringStack,
              }
            )}
          </li>
        </ol>
      </InstructionWrapper>
    );
  };
  render = () => {
    const model = this.model;
    const formFields: JsonFormObject = {
      title: t('Install Sentry to your AWS account'),
      fields: [
        {
          name: 'awsExternalId',
          type: 'hidden',
          required: true,
        },
        {
          name: 'arn',
          type: 'text',
          required: true,
          label: t('ARN'),
          inline: false,
          placeholder:
            'arn:aws:iam::XXXXXXXXXXXX:stack/SentryMonitoringStack-XXXXXXXXXXXXX',
          validate: ({id, form}) => {
            const value = form[id];
            // validate the ARN matches a cloudformation stack
            return /arn:aws:cloudformation:\S+:\d+:stack+\/\S+/.test(value)
              ? []
              : [[id, 'Invalid ARN']];
          },
        },
      ],
    };
    return (
      <StyledForm
        initialData={this.initialData}
        model={model}
        onSubmit={this.handleSubmit}
      >
        <JsonForm renderHeader={this.renderFormHeader} forms={[formFields]} />
      </StyledForm>
    );
  };
}

const StyledForm = styled(Form)`
  margin: 50px;
  padding-bottom: 50px;
`;

const InstructionWrapper = styled('div')`
  margin: 20px;
`;
