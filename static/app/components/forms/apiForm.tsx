import {Component} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';

type Props = Form['props'] & {
  apiEndpoint: string;
  apiMethod: string;
  onSubmit?: (data: Record<string, any>) => void;
};

export default class ApiForm extends Component<Props> {
  componentWillUnmount() {
    this.api.clear();
  }

  api: Client = new Client();

  onSubmit = (
    data: Record<string, any>,
    onSuccess: (response: Record<string, any>) => void,
    onError: (error: any) => void
  ) => {
    this.props.onSubmit && this.props.onSubmit(data);
    addLoadingMessage(t('Saving changes\u2026'));
    this.api.request(this.props.apiEndpoint, {
      method: this.props.apiMethod,
      data,
      success: response => {
        clearIndicators();
        onSuccess(response);
      },
      error: error => {
        clearIndicators();
        onError(error);
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
