import React from 'react';
import styled from '@emotion/styled';
import reduce from 'lodash/reduce';
import {Observer} from 'mobx-react';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

const LAMBDA_COUNT_THRESHOLD = 10;

type LambdaFunction = {FunctionName: string; Runtime: string};

type Props = {
  lambdaFunctions: LambdaFunction[];
};

type State = {
  submitting: boolean;
};

const getLabel = (func: LambdaFunction) => func.FunctionName;

export default class AwsLambdaFunctionSelect extends React.Component<Props, State> {
  state = {
    submitting: false,
  };

  model = new FormModel({apiOptions: {baseUrl: window.location.origin}});

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

  handleSubmit = () => {
    this.model.saveForm();
    this.setState({submitting: true});
  };

  renderWhatWeFound = () => {
    const count = this.lambdaFunctions.length;
    return (
      <WhatWeFound>{t('We found %s functions with Node runtimes', count)}</WhatWeFound>
    );
  };

  renderLoadingScreeen = () => {
    const count = this.enabledCount;
    const text =
      count > LAMBDA_COUNT_THRESHOLD
        ? t('This might take a while\u2026', count)
        : t('This might take a sec\u2026');
    return (
      <LoadingWrapper>
        <StyledLoadingIndicator />
        <LoadingLine1>{t('Adding Sentry to %s functions', count)}</LoadingLine1>
        {text}
      </LoadingWrapper>
    );
  };

  renderCore = () => {
    const model = this.model;
    const formFields: JsonFormObject = {
      fields: this.lambdaFunctions.map(func => {
        return {
          name: func.FunctionName,
          type: 'boolean',
          required: false,
          label: getLabel(func),
          alignRight: true,
        };
      }),
    };
    return (
      <List symbol="colored-numeric">
        <ListItem>
          <Header>{this.renderWhatWeFound()}</Header>
          {t('Decide which functions you would like to enable for Sentry monitoring')}
          <StyledForm
            initialData={this.initialData}
            skipPreventDefault
            model={model}
            apiEndpoint="/extensions/aws_lambda/setup/"
            hideFooter
          >
            <JsonForm forms={[formFields]} />
          </StyledForm>
        </ListItem>
        <React.Fragment />
      </List>
    );
  };
  render = () => {
    return (
      <React.Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
        <Wrapper>
          {this.state.submitting ? this.renderLoadingScreeen() : this.renderCore()}
        </Wrapper>
        <Observer>
          {() => (
            <FooterWithButtons
              buttonText={t('Finish Setup')}
              onClick={this.handleSubmit}
              disabled={this.model.isError || this.model.isSaving}
            />
          )}
        </Observer>
      </React.Fragment>
    );
  };
}

const Wrapper = styled('div')`
  margin: 100px 50px 50px 50px;
`;

const StyledForm = styled(Form)`
  margin-top: 10px;
`;

const WhatWeFound = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
`;

const Header = styled('div')`
  text-align: left;
  margin-bottom: 10px;
`;

const LoadingWrapper = styled('div')`
  padding: 50px;
  text-align: center;
`;

const LoadingLine1 = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-bottom: 10px;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
