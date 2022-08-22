import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import reduce from 'lodash/reduce';
import {computed, makeObservable} from 'mobx';
import {Observer} from 'mobx-react';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {JsonFormObject} from 'sentry/components/forms/type';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelHeader} from 'sentry/components/panels';
import Switch from 'sentry/components/switchButton';
import Tooltip from 'sentry/components/tooltip';
import {t, tn} from 'sentry/locale';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

const LAMBDA_COUNT_THRESHOLD = 10;

type LambdaFunction = {FunctionName: string; Runtime: string};

type Props = {
  initialStepNumber: number;
  lambdaFunctions: LambdaFunction[];
};

type State = {
  submitting: boolean;
};

const getLabel = (func: LambdaFunction) => func.FunctionName;

export default class AwsLambdaFunctionSelect extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    makeObservable(this, {allStatesToggled: computed});
  }
  state: State = {
    submitting: false,
  };

  model = new FormModel();

  get initialData() {
    const {lambdaFunctions} = this.props;
    const initialData = lambdaFunctions.reduce((accum, func) => {
      accum[func.FunctionName] = true;
      return accum;
    }, {});
    return initialData;
  }

  get lambdaFunctions() {
    return this.props.lambdaFunctions.sort((a, b) =>
      getLabel(a).toLowerCase() < getLabel(b).toLowerCase() ? -1 : 1
    );
  }

  get enabledCount() {
    const data = this.model.getTransformedData();
    return reduce(data, (acc: number, val: boolean) => (val ? acc + 1 : acc), 0);
  }

  get allStatesToggled() {
    // check if any of the lambda functions have a falsy value
    // no falsy values means everything is enabled
    return Object.values(this.model.getData()).every(val => val);
  }

  get formFields() {
    const data = this.model.getTransformedData();
    return Object.entries(data).map(([name, value]) => ({name, value}));
  }

  handleSubmit = () => {
    this.setState({submitting: true});
  };

  handleToggle = () => {
    const newState = !this.allStatesToggled;
    this.lambdaFunctions.forEach(lambda => {
      this.model.setValue(lambda.FunctionName, newState, {quiet: true});
    });
  };

  renderWhatWeFound = () => {
    const count = this.lambdaFunctions.length;
    return (
      <h4>
        {tn(
          'We found %s function with a Node or Python runtime',
          'We found %s functions with Node or Python runtimes',
          count
        )}
      </h4>
    );
  };

  renderLoadingScreen = () => {
    const count = this.enabledCount;
    const text =
      count > LAMBDA_COUNT_THRESHOLD
        ? t('This might take a while\u2026', count)
        : t('This might take a sec\u2026');
    return (
      <LoadingWrapper>
        <StyledLoadingIndicator />
        <h4>{t('Adding Sentry to %s functions', count)}</h4>
        {text}
      </LoadingWrapper>
    );
  };

  renderCore = () => {
    const {initialStepNumber} = this.props;

    const FormHeader = (
      <StyledPanelHeader>
        {t('Lambda Functions')}
        <SwitchHolder>
          <Observer>
            {() => (
              <Tooltip
                title={this.allStatesToggled ? t('Disable All') : t('Enable All')}
                position="left"
              >
                <StyledSwitch
                  size="lg"
                  name="toggleAll"
                  toggle={this.handleToggle}
                  isActive={this.allStatesToggled}
                />
              </Tooltip>
            )}
          </Observer>
        </SwitchHolder>
      </StyledPanelHeader>
    );

    const formFields: JsonFormObject = {
      fields: this.lambdaFunctions.map(func => ({
        name: func.FunctionName,
        type: 'boolean',
        required: false,
        label: getLabel(func),
        alignRight: true,
      })),
    };

    return (
      <List symbol="colored-numeric" initialCounterValue={initialStepNumber}>
        <ListItem>
          <Header>{this.renderWhatWeFound()}</Header>
          {t('Decide which functions you would like to enable for Sentry monitoring')}
          <StyledForm
            initialData={this.initialData}
            model={this.model}
            apiEndpoint="/extensions/aws_lambda/setup/"
            hideFooter
            preventFormResetOnUnmount
          >
            <JsonForm renderHeader={() => FormHeader} forms={[formFields]} />
          </StyledForm>
        </ListItem>
        <Fragment />
      </List>
    );
  };

  render() {
    return (
      <Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/" />
        <Wrapper>
          {this.state.submitting ? this.renderLoadingScreen() : this.renderCore()}
        </Wrapper>
        <Observer>
          {() => (
            <FooterWithButtons
              formProps={{
                action: '/extensions/aws_lambda/setup/',
                method: 'post',
                onSubmit: this.handleSubmit,
              }}
              formFields={this.formFields}
              buttonText={t('Finish Setup')}
              disabled={
                this.model.isError || this.model.isSaving || this.state.submitting
              }
            />
          )}
        </Observer>
      </Fragment>
    );
  }
}

const Wrapper = styled('div')`
  padding: 100px 50px 50px 50px;
`;

// TODO(ts): Understand why styled is not correctly inheriting props here
const StyledForm = styled(Form)<Form['props']>`
  margin-top: 10px;
`;

const Header = styled('div')`
  text-align: left;
  margin-bottom: 10px;
`;

const LoadingWrapper = styled('div')`
  padding: 50px;
  text-align: center;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const SwitchHolder = styled('div')`
  display: flex;
`;

const StyledSwitch = styled(Switch)`
  margin: auto;
`;

// padding is based on fom control width
const StyledPanelHeader = styled(PanelHeader)`
  padding-right: 36px;
`;
