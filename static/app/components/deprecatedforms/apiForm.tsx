import * as React from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {APIRequestMethod, Client} from 'sentry/api';
import Form from 'sentry/components/deprecatedforms/form';
import FormField from 'sentry/components/deprecatedforms/formField';
import FormState from 'sentry/components/forms/state';
import {t} from 'sentry/locale';

type Props = Form['props'] & {
  apiEndpoint: string;
  apiMethod: APIRequestMethod;
  omitDisabled?: boolean;
  onSubmit?: (data: object) => void;
  submitErrorMessage?: string;
  submitLoadingMessage?: string;
};

export default class ApiForm extends Form<Props> {
  api = new Client();

  static defaultProps = {
    ...Form.defaultProps,
    omitDisabled: false, // TODO(chadwhitacre) Upstream, flip to true, deprecate.
    submitErrorMessage: t('There was an error saving your changes.'),
    submitLoadingMessage: t('Saving changes\u2026'),
  };

  componentWillUnmount() {
    this.api.clear();
  }

  getEnabledData() {
    // Return a hash of data from non-disabled fields.

    // Start with this.state.data and remove rather than starting from scratch
    // and adding, because a) this.state.data is our source of truth, and b)
    // we'd have to do more work to loop over the state.data Object and lookup
    // against the props.children Array (looping over the Array and looking up
    // in the Object is more natural). Maybe the consequent use of delete
    // carries a slight performance hit. Why is yer form so big? 🤔

    const data = {...this.state.data}; // Copy to avoid mutating state.data itself.
    React.Children.forEach(this.props.children, (child: any) => {
      if (!FormField.isPrototypeOf(child.type)) {
        return; // Form children include h4's, etc.
      }
      if (child.key && child.props?.disabled) {
        delete data[child.key]; // Assume a link between child.key and data. 🐭
      }
    });
    return data;
  }

  onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (this.state.state === FormState.SAVING) {
      return;
    }

    // Actual HTML forms do not submit data for disabled fields, and because of
    // the way some of our APIs are implemented, we need to start doing the
    // same. But, since some other parts of the app very probably depend on
    // sending disabled fields, keep that the default for now.
    // TODO(chadwhitacre): Expand and upstream this.
    const data = this.props.omitDisabled ? this.getEnabledData() : this.state.data;

    this.props.onSubmit && this.props.onSubmit(data);
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        addLoadingMessage(this.props.submitLoadingMessage);
        this.api.request(this.props.apiEndpoint, {
          method: this.props.apiMethod,
          data,
          success: result => {
            clearIndicators();
            this.onSubmitSuccess(result);
          },
          error: error => {
            addErrorMessage(this.props.submitErrorMessage);
            this.onSubmitError(error);
          },
        });
      }
    );
  };
}
