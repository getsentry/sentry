import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

import FooterWithButtons from './components/footerWithButtons';
import IconGroup from './components/iconGroup';

type LambdaFunction = {FunctionName: string; Runtime: string};
type Props = {
  lambdaFunctions: LambdaFunction[];
};

const getLabel = (func: LambdaFunction) => func.FunctionName;

export default class AwsLambdaFunctionSelect extends React.Component<Props> {
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
  handlePreSubmit = () => addLoadingMessage(t('Submitting\u2026'));
  handleSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
    this.model.saveForm();
  };
  renderWhatWeFound = () => {
    const count = this.lambdaFunctions.length;
    return (
      <WhatWeFound>{t('We found %s functions with Node runtimes', count)}</WhatWeFound>
    );
  };
  handleSubmitSuccess = () => {};
  renderFooter = () => {
    return (
      <Observer>
        {() => (
          <FooterWithButtons
            docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/"
            buttonText={t('Finish Setup')}
            onClick={this.handleSubmit}
            disabled={this.model.isError || this.model.isSaving}
          />
        )}
      </Observer>
    );
  };
  render = () => {
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
      <Wrapper>
        <Alert type="info">{t('Currently only supports Node runtimes')}</Alert>
        <Header>
          <IconGroup pluginId="aws_lambda" />
          {this.renderWhatWeFound()}
        </Header>
        <StyledForm
          initialData={this.initialData}
          skipPreventDefault
          model={model}
          apiEndpoint="/extensions/aws_lambda/setup/"
          hideFooter
          onSubmitSuccess={this.handleSubmitSuccess}
        >
          <JsonForm forms={[formFields]} />
        </StyledForm>
        {this.renderFooter()}
      </Wrapper>
    );
  };
}

const StyledForm = styled(Form)`
  margin: 50px;
  padding-bottom: 50px;
`;

const Wrapper = styled('div')``;

const WhatWeFound = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
`;

const Header = styled('div')`
  text-align: center;
`;
