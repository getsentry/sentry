import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type Props = {
  cloudformationUrl: string;
  awsExternalId: string;
  arn?: string;
  arnError?: string;
};

export default class AwsLambdaCloudformation extends React.Component<Props> {
  componentDidMount() {
    // show the error if we have it
    const {arnError} = this.props;
    if (arnError) {
      this.model.setError('arn', arnError);
    }
  }
  model = new FormModel({apiOptions: {baseUrl: window.location.origin}});
  get initialData() {
    const {awsExternalId, arn} = this.props;
    return {
      awsExternalId,
      arn,
    };
  }
  handlePreSubmit = () => addLoadingMessage(t('Submitting\u2026'));
  handleSubmitError = () => addErrorMessage(t('Unexpected error ocurred!'));
  renderFormHeader = () => {
    const {cloudformationUrl} = this.props;
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
          label: 'test',
        },
        {
          name: 'arn',
          type: 'text',
          required: true,
          label: t('ARN'),
          inline: false,
          placeholder:
            'arn:aws:iam::XXXXXXXXXXXX:role/SentryMonitoringStack-XXXXXXXXXXXXX',
        },
      ],
    };
    return (
      <StyledForm
        initialData={this.initialData}
        skipPreventDefault
        model={model}
        apiEndpoint="/extensions/aws_lambda/setup/"
        onPreSubmit={this.handlePreSubmit}
        onSubmitError={this.handleSubmitError}
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
