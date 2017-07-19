import React from 'react';

import {Client} from '../../api';
import IndicatorStore from '../../stores/indicatorStore';
import Form from './form';
import FormState from './state';
import {t} from '../../locale';

export default class ApiForm extends Form {
  static propTypes = {
    ...Form.propTypes,
    onSubmit: React.PropTypes.func,
    apiMethod: React.PropTypes.string.isRequired,
    apiEndpoint: React.PropTypes.string.isRequired
  };

  constructor(props, context) {
    super(props, context);
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onSubmit = e => {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }

    let {data} = this.state;

    this.props.onSubmit && this.props.onSubmit(data);
    this.setState(
      {
        state: FormState.SAVING
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request(this.props.apiEndpoint, {
          method: this.props.apiMethod,
          data: data,
          success: result => {
            IndicatorStore.remove(loadingIndicator);
            this.onSubmitSuccess(result);
          },
          error: error => {
            IndicatorStore.remove(loadingIndicator);
            this.onSubmitError(error);
          }
        });
      }
    );
  };
}
