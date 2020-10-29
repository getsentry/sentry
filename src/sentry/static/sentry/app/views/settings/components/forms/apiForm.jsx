import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';

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
    addLoadingMessage(t('Saving changes\u2026'));
    this.api.request(this.props.apiEndpoint, {
      method: this.props.apiMethod,
      data,
      success: (...args) => {
        clearIndicators();
        onSuccess(...args);
      },
      error: (...args) => {
        clearIndicators();
        onError(...args);
      },
    });
  };

  render() {
    const {
      onSubmit: _onSubmit,
      apiMethod: _apiMethod,
      apiEndpoint: _apiEndpoint,
      ...otherProps
    } = this.props;

    return <Form onSubmit={this.onSubmit} {...otherProps} />;
  }
}
