import PropTypes from 'prop-types';

import {Client, APIRequestMethod} from 'app/api';
import IndicatorStore from 'app/stores/indicatorStore';
import Form from 'app/components/forms/form';
import FormState from 'app/components/forms/state';
import {t} from 'app/locale';

type Props = Form['props'] & {
  onSubmit?: (data: object) => void;
  apiEndpoint: string;
  apiMethod: APIRequestMethod;
  submitLoadingMessage?: string;
  submitErrorMessage?: string;
};

export default class ApiForm extends Form<Props> {
  api = new Client();

  static propTypes = {
    ...Form.propTypes,
    onSubmit: PropTypes.func,
    apiMethod: PropTypes.string.isRequired,
    apiEndpoint: PropTypes.string.isRequired,
    submitLoadingMessage: PropTypes.string,
    submitErrorMessage: PropTypes.string,
  };

  static defaultProps = {
    ...Form.defaultProps,
    submitErrorMessage: t('There was an error saving your changes.'),
    submitLoadingMessage: t('Saving changes..'),
  };

  componentWillUnmount() {
    this.api.clear();
  }

  onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (this.state.state === FormState.SAVING) {
      return;
    }

    const {data} = this.state;

    this.props.onSubmit && this.props.onSubmit(data);
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        const loadingIndicator = IndicatorStore.add(this.props.submitLoadingMessage);
        this.api.request(this.props.apiEndpoint, {
          method: this.props.apiMethod,
          data,
          success: result => {
            IndicatorStore.remove(loadingIndicator);
            this.onSubmitSuccess(result);
          },
          error: error => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(this.props.submitErrorMessage, 'error');
            this.onSubmitError(error);
          },
        });
      }
    );
  };
}
