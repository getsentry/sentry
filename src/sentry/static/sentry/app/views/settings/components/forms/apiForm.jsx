import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import IndicatorStore from 'app/stores/indicatorStore';
import Form from 'app/views/settings/components/forms/form';
import {t} from 'app/locale';

export default class ApiForm extends React.Component {
  static propTypes = {
    ...Form.propTypes,
    onSubmit: PropTypes.func,
    apiMethod: PropTypes.string.isRequired,
    apiEndpoint: PropTypes.string.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onSubmit = (data, onSuccess, onError) => {
    this.props.onSubmit && this.props.onSubmit(data);
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(this.props.apiEndpoint, {
      method: this.props.apiMethod,
      data,
      success: (...args) => {
        IndicatorStore.remove(loadingIndicator);
        onSuccess(...args);
      },
      error: (...args) => {
        IndicatorStore.remove(loadingIndicator);
        onError(...args);
      },
    });
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    let {onSubmit, apiMethod, apiEndpoint, ...otherProps} = this.props;

    return <Form onSubmit={this.onSubmit} {...otherProps} />;
  }
}
