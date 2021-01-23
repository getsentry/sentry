import React from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/actions/button';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {uniqueId} from 'app/utils/guid';
import StepHeading from 'app/views/onboarding/components/stepHeading';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

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

const accountNumberRegex = /^\d{12}$/;
const testAccountNumber = (arn: string) => accountNumberRegex.test(arn);

type Props = {
  baseCloudformationUrl: string;
  templateUrl: string;
  stackName: string;
  regionList: string[];
  accountNumber?: string;
  region?: string;
  error?: string;
};

type State = {
  accountNumber?: string;
  region?: string;
  accountNumberError?: string;
  submitting?: boolean;
};

export default class AwsLambdaCloudformation extends React.Component<Props, State> {
  state: State = {
    accountNumber: this.props.accountNumber,
    region: this.props.region,
  };

  componentDidMount() {
    // show the error if we have it
    const {error} = this.props;
    if (error) {
      addErrorMessage(error, {duration: 10000});
    }
  }

  get initialData() {
    const {region, accountNumber} = this.props;
    const awsExternalId = getAwsExternalId();
    return {
      awsExternalId,
      region,
      accountNumber,
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

  get regionOptions() {
    return this.props.regionList.map(region => ({value: region, label: region}));
  }

  handleSubmit = (e: React.MouseEvent) => {
    this.setState({submitting: true});
    e.preventDefault();
    const {accountNumber, region} = this.state;
    const data = {
      accountNumber,
      region,
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

  validateAccountNumber = (value: string) => {
    // validate the account number
    let accountNumberError = '';
    if (!value) {
      accountNumberError = t('Account number required');
    } else if (!testAccountNumber(value)) {
      accountNumberError = t('Invalid account number');
    }
    this.setState({accountNumberError});
  };

  handleChangeArn = (accountNumber: string) => {
    // reset the error if we ever get a valid account number
    if (testAccountNumber(accountNumber)) {
      this.setState({accountNumberError: ''});
    }
    this.setState({accountNumber});
  };

  hanldeChangeRegion = (region: string) => {
    this.setState({region});
  };

  get formValid() {
    const {accountNumber, region} = this.state;
    return !!region && testAccountNumber(accountNumber || '');
  }

  renderInstructions = () => {
    return (
      <InstructionWrapper>
        <StyledStepHeading step={1}>
          {t("Add Sentry's CloudFormation to your AWS")}
        </StyledStepHeading>
        <GoToAWSWrapper>
          <Button priority="primary" external href={this.cloudformationUrl}>
            {t('Configure AWS')}
          </Button>
        </GoToAWSWrapper>
        <StyledStepHeading step={2}>
          {t('Add AWS Account Infomrmation')}
        </StyledStepHeading>
      </InstructionWrapper>
    );
  };

  render = () => {
    const {accountNumber, region, accountNumberError, submitting} = this.state;
    return (
      <div>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
        <StyledAlert type="info">
          {t('It might take a minute for the CloudFormation stack to be created')}
        </StyledAlert>
        <InstallSentry>{t('Install Sentry on your AWS Account')}</InstallSentry>
        {this.renderInstructions()}
        <StyledTextField
          name="accountNumber"
          placeholder="599817902985"
          value={accountNumber}
          onChange={this.handleChangeArn}
          onBlur={this.validateAccountNumber}
          error={accountNumberError}
          inline={false}
          label={t('AWS Account Number')}
        />
        <StyledSelectField
          name="region"
          placeholder="us-east-2"
          value={region}
          onChange={this.hanldeChangeRegion}
          options={this.regionOptions}
          allowClear={false}
          inline={false}
          label={t('AWS Region')}
        />
        <FooterWithButtons
          buttonText={t('Next')}
          onClick={this.handleSubmit}
          disabled={submitting || !this.formValid}
        />
      </div>
    );
  };
}

const InstructionWrapper = styled('div')`
  margin-left: 20px;
`;

const StyledStepHeading = styled(StepHeading)`
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 10px 0 0 0;
`;

const StyledTextField = styled(TextField)`
  padding: ${space(1)} 65px;
  border-bottom: none;
`;

const StyledSelectField = styled(SelectField)`
  padding: ${space(1)} 65px;
  border-bottom: none;
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
