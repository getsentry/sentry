import React from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {uniqueId} from 'app/utils/guid';
import StepHeading from 'app/views/onboarding/components/stepHeading';
import FieldErrorReason from 'app/views/settings/components/forms/field/fieldErrorReason';
import TextareaField from 'app/views/settings/components/forms/textareaField';

import FooterWithButtons from './components/footerWithButtons';
import IconGroup from './components/iconGroup';

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

const cloudformationRegex = /arn:aws:cloudformation:\S+:\d+:stack+\/\S+/;
const testArn = (arn: string) => cloudformationRegex.test(arn);

type Props = {
  baseCloudformationUrl: string;
  templateUrl: string;
  stackName: string;
  arn?: string;
  error?: string;
};

type State = {
  arn?: string;
  syncError?: string;
  submitting?: boolean;
};

export default class AwsLambdaCloudformation extends React.Component<Props, State> {
  state: State = {
    arn: this.props.arn,
  };
  componentDidMount() {
    // show the error if we have it
    const {error} = this.props;
    if (error) {
      addErrorMessage(error, {duration: 10000});
    }
  }
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
  handleSubmit = (e: React.MouseEvent) => {
    this.setState({submitting: true});
    e.preventDefault();
    const {arn} = this.state;
    const data = {
      arn,
      awsExternalId: getAwsExternalId(),
    };
    addLoadingMessage(t('Submitting\u2026'));
    const {
      location: {origin},
    } = window;
    // redirect to the extensions endpoint with the form fields as query params
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const newUrl = `${origin}/extensions/aws_lambda/setup/?${qs.stringify(data)}`;
    window.location.assign(newUrl);
  };
  validateArn = (value: string) => {
    // validate the ARN matches a cloudformation stack
    let syncError: string | undefined;
    if (!value) {
      syncError = t('ARN required');
    } else if (testArn(value)) {
      syncError = t('Invalid ARN');
    }
    this.setState({syncError});
  };
  handleChangeArn = (arn: string) => {
    this.setState({arn});
  };
  get arnValid() {
    return testArn(this.state.arn || '');
  }
  renderInstructions = () => {
    return (
      <InstructionWrapper>
        <StyledStepHeading step={1}>
          {t("Add Sentry's CloudFormation to your AWS")}
        </StyledStepHeading>
        <GoToAWSWrapper>
          <ExternalLink href={this.cloudformationUrl}>{t('Go to AWS')}</ExternalLink>
        </GoToAWSWrapper>
        <StyledStepHeading step={2}>
          {t('Enter the ARN Value from AWS')}
        </StyledStepHeading>
      </InstructionWrapper>
    );
  };
  render = () => {
    const {arn, syncError, submitting} = this.state;
    return (
      <div>
        <StyledAlert type="info">
          {t('It might take a minute for the CloudFormation stack to be created')}
        </StyledAlert>
        <IconGroup pluginId="aws_lambda" />
        <InstallSentry>{t('Install Sentry on your AWS Account')}</InstallSentry>
        {this.renderInstructions()}
        <StyledTextareaField
          name="arn"
          placeholder="arn:aws:cloudformation:us-east-2:599817902985:stack/Sentry-Monitoring-Stack-Filter/a3644150-5560-11eb-b6e6-0abd43d40ad8"
          value={arn}
          onChange={this.handleChangeArn}
          onBlur={this.validateArn}
          error={syncError}
          inline={false}
          autosize
        />
        <FooterWithButtons
          buttonText={t('Next')}
          onClick={this.handleSubmit}
          disabled={submitting || !this.arnValid}
        />
      </div>
    );
  };
}

const InstructionWrapper = styled('div')`
  margin-left: 20px;
`;

const StyledStepHeading = styled(StepHeading)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 10px 0 0 0;
`;

const StyledTextareaField = styled(TextareaField)`
  padding: ${space(1)} 65px;
  ${FieldErrorReason} {
    right: 67px;
  }
`;

const InstallSentry = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin: 20px;
  text-align: center;
`;

const GoToAWSWrapper = styled('div')`
  margin-left: 46px;
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
`;
