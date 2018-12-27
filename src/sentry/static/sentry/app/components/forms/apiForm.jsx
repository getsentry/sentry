import PropTypes from 'prop-types';

import {Client} from 'app/api';
import IndicatorStore from 'app/stores/indicatorStore';
import Form from 'app/components/forms/form';
import FormState from 'app/components/forms/state';
import {t} from 'app/locale';

export default class ApiForm extends Form {
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
        state: FormState.SAVING,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(this.props.submitLoadingMessage);
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
