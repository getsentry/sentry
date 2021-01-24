import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

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

  handleSubmit = () => {
    //submitting can take a while...
    addLoadingMessage(t('Submitting\u2026', {duration: 120 * 1000}));
    this.model.saveForm();
  };

  renderWhatWeFound = () => {
    const count = this.lambdaFunctions.length;
    return (
      <WhatWeFound>{t('We found %s functions with Node runtimes', count)}</WhatWeFound>
    );
  };

  renderFooter = () => {
    return (
      <Observer>
        {() => (
          <FooterWithButtons
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
      <React.Fragment>
        <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
        <StyledList symbol="colored-numeric">
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
        </StyledList>
        {this.renderFooter()}
      </React.Fragment>
    );
  };
}

const StyledList = styled(List)`
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
