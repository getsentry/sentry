import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import * as qs from 'query-string';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/actions/button';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {uniqueId} from 'app/utils/guid';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
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
  initialStepNumber: number;
  organization: Organization;
  accountNumber?: string;
  region?: string;
  error?: string;
  awsExternalId?: string;
};

type State = {
  awsExternalId?: string;
  accountNumber?: string;
  region?: string;
  accountNumberError?: string;
  submitting?: boolean;
  showInputs?: boolean;
};

export default class AwsLambdaCloudformation extends React.Component<Props, State> {
  state: State = {
    accountNumber: this.props.accountNumber,
    region: this.props.region,
    awsExternalId: this.props.awsExternalId ?? getAwsExternalId(),
    showInputs: !!this.props.awsExternalId,
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
    const {awsExternalId} = this.state;
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
    //always us the generated AWS External ID in local storage
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
    //use the external ID from the form on on the submission
    const {accountNumber, region, awsExternalId} = this.state;
    const data = {
      accountNumber,
      region,
      awsExternalId,
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
    this.debouncedTrackValueChanged('accountNumber');
    // reset the error if we ever get a valid account number
    if (testAccountNumber(accountNumber)) {
      this.setState({accountNumberError: ''});
    }
    this.setState({accountNumber});
  };

  hanldeChangeRegion = (region: string) => {
    this.debouncedTrackValueChanged('region');
    this.setState({region});
  };

  handleChangeExternalId = (awsExternalId: string) => {
    this.debouncedTrackValueChanged('awsExternalId');
    awsExternalId = awsExternalId.trim();
    this.setState({awsExternalId});
  };

  handleChangeShowInputs = () => {
    this.setState({showInputs: true});
    trackIntegrationEvent(
      'integrations.installation_input_value_changed',
      {
        integration: 'aws_lambda',
        integration_type: 'first_party',
        field_name: 'showInputs',
      },
      this.props.organization
    );
  };

  get formValid() {
    const {accountNumber, region, awsExternalId} = this.state;
    return !!region && testAccountNumber(accountNumber || '') && !!awsExternalId;
  }

  //debounce so we don't send a request on every input change
  debouncedTrackValueChanged = debounce((fieldName: string) => {
    trackIntegrationEvent(
      'integrations.installation_input_value_changed',
      {
        integration: 'aws_lambda',
        integration_type: 'first_party',
        field_name: fieldName,
      },
      this.props.organization
    );
  }, 200);

  trackOpenCloudFormation = () => {
    trackIntegrationEvent(
      'integrations.cloudformation_link_clicked',
      {
        integration: 'aws_lambda',
        integration_type: 'first_party',
      },
      this.props.organization
    );
  };

  render = () => {
    const {initialStepNumber} = this.props;
    const {
      accountNumber,
      region,
      accountNumberError,
      submitting,
      awsExternalId,
      showInputs,
    } = this.state;
    return (
      <React.Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws-lambda/" />
        <StyledList symbol="colored-numeric" initialCounterValue={initialStepNumber}>
          <ListItem>
            <h3>{t("Add Sentry's CloudFormation")}</h3>
            <StyledButton
              priority="primary"
              onClick={this.trackOpenCloudFormation}
              external
              href={this.cloudformationUrl}
            >
              {t('Go to AWS')}
            </StyledButton>
            {!showInputs && (
              <React.Fragment>
                <p>
                  {t(
                    "Once you've created Sentry's CloudFormation stack (or if you already have one) press the button below to continue."
                  )}
                </p>
                <Button name="showInputs" onClick={this.handleChangeShowInputs}>
                  {t("I've created the stack")}
                </Button>
              </React.Fragment>
            )}
          </ListItem>
          {showInputs ? (
            <ListItem>
              <h3>{t('Add AWS Account Information')}</h3>
              <TextField
                name="accountNumber"
                value={accountNumber}
                onChange={this.handleChangeArn}
                onBlur={this.validateAccountNumber}
                error={accountNumberError}
                inline={false}
                stacked
                label={t('AWS Account Number')}
                showHelpInTooltip
                help={t(
                  'Your account number can be found on the right side of the header in AWS'
                )}
              />
              <SelectField
                name="region"
                value={region}
                onChange={this.hanldeChangeRegion}
                options={this.regionOptions}
                allowClear={false}
                inline={false}
                stacked
                label={t('AWS Region')}
                showHelpInTooltip
                help={t(
                  'Your current region can be found on the right side of the header in AWS'
                )}
              />
              <TextField
                name="awsExternalId"
                value={awsExternalId}
                onChange={this.handleChangeExternalId}
                inline={false}
                stacked
                error={awsExternalId ? '' : t('External ID Required')}
                label={t('External ID')}
                showHelpInTooltip
                help={t(
                  'Do not edit unless you are copying from a previously created CloudFormation stack'
                )}
              />
            </ListItem>
          ) : (
            <React.Fragment />
          )}
        </StyledList>
        <FooterWithButtons
          buttonText={t('Next')}
          onClick={this.handleSubmit}
          disabled={submitting || !this.formValid}
        />
      </React.Fragment>
    );
  };
}

const StyledList = styled(List)`
  padding: 100px 50px 50px 50px;
`;

const StyledButton = styled(Button)`
  margin-bottom: 20px;
`;
