import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/actions/button';
import Alert from 'app/components/alert';
import {IconSentry} from 'app/icons';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

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
    // window.location.reload();
  };
  renderWhatWeFound = () => {
    const count = this.lambdaFunctions.length;
    return <WhatWeFound>{t('We found %s functions', count)}</WhatWeFound>;
  };
  handleSubmitSuccess = () => {};
  renderFooter = () => {
    return (
      <Footer>
        <ButtonWrapper>
          <StyledButton size="small">{t('View Docs')}</StyledButton>
          <Observer>
            {() => (
              <StyledButton
                priority="primary"
                disabled={this.model.isError || this.model.isSaving}
                type="submit"
                onClick={this.handleSubmit}
                size="small"
              >
                {t('Finish Setup')}
              </StyledButton>
            )}
          </Observer>
        </ButtonWrapper>
      </Footer>
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
          <IconWrapper>
            <PluginIcon size={50} pluginId="aws_lambda" />
            <StyledIconSentry />
          </IconWrapper>
          {this.renderWhatWeFound()}
        </Header>
        <StyledForm
          initialData={this.initialData}
          skipPreventDefault
          model={model}
          apiEndpoint="/extensions/aws_lambda/setup/"
          // onPreSubmit={this.handlePreSubmit}
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

//wrap in form so we can keep form submission behavior
const Footer = styled('form')`
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 60px;
  z-index: 100;
  background-color: ${p => p.theme.bodyBackground};
  border-top: 1px solid ${p => p.theme.gray100};
`;

const StyledButton = styled(Button)`
  padding: 0;
  margin-right: 20px;
`;

const ButtonWrapper = styled('div')`
  padding: 20px 0;
  float: right;
`;

const WhatWeFound = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
`;

const IconWrapper = styled('div')``;

const StyledIconSentry = styled(IconSentry)`
  width: 50px;
  height: 50px;
  margin-left: 40px;
`;

const Header = styled('div')`
  text-align: center;
`;
