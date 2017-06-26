import React from 'react';

import {Client} from '../../api';
import IndicatorStore from '../../stores/indicatorStore';
import Form from './form';
import FormState from './state';
import {t} from '../../locale';

class ApiForm extends Form {
  constructor(props) {
    super(props);
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onSubmit(e) {
    super.onSubmit(e);

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request(this.props.apiEndpoint, {
          method: this.props.apiMethod,
          data: this.state.formData,
          success: data => {
            this.setState({
              state: FormState.READY,
              errors: {}
            });
            this.props.onSubmitComplete && this.props.onSubmitComplete(data);
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON
            });
            this.props.onSubmitError && this.props.onSubmitError(error);
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
        });
      }
    );
  }
}

ApiForm.propTypes = {
  ...Form.propTypes,
  onSubmit: React.PropTypes.func,
  onSubmitComplete: React.PropTypes.func.isRequired,
  onSubmitError: React.PropTypes.func,
  apiMethod: React.PropTypes.string.isRequired,
  apiEndpoint: React.PropTypes.string.isRequired
};

export default ApiForm;
