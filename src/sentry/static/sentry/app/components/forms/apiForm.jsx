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

  constructor(props) {
    super(props);
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }

    let {formData} = this.state;

    this.props.onSubmit && this.props.onSubmit(formData);
    this.setState(
      {
        state: FormState.SAVING
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request(this.props.apiEndpoint, {
          method: this.props.apiMethod,
          data: formData,
          success: data => {
            this.onSubmitSuccess(data);
          },
          error: error => {
            this.onSubmitError(error);
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
        });
      }
    );
  }
}
