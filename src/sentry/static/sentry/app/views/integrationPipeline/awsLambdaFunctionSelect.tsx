import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type LambdaFunction = {FunctionName: string; Runtime: string};
type Props = {
  lambdaFunctions: LambdaFunction[];
};

const getLabel = (func: LambdaFunction) => `${func.FunctionName} - ${func.Runtime}`;

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
  handlePreSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
  };
  handleSubmitError = () => {
    addErrorMessage(t('Unexpected error ocurred!'));
  };
  render = () => {
    const model = this.model;
    const formFields: JsonFormObject = {
      title: t('Select the lambda functions to install Sentry on'),
      fields: this.lambdaFunctions.map(func => {
        return {
          name: func.FunctionName,
          type: 'boolean',
          required: false,
          label: getLabel(func),
        };
      }),
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
        <JsonForm forms={[formFields]} />
      </StyledForm>
    );
  };
}

const StyledForm = styled(Form)`
  margin: 50px;
  padding-bottom: 50px;
`;
