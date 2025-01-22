import {Component} from 'react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Relay} from 'sentry/types/relay';

import createTrustedRelaysResponseError from './createTrustedRelaysResponseError';
import Form from './form';
import Modal from './modal';

type FormProps = React.ComponentProps<typeof Form>;
type Values = FormProps['values'];

type Props = ModalRenderProps & {
  api: Client;
  onSubmitSuccess: (organization: Organization) => void;
  orgSlug: Organization['slug'];
  savedRelays: Relay[];
};

type State = {
  disables: FormProps['disables'];
  errors: FormProps['errors'];
  isFormValid: boolean;
  requiredValues: (keyof Values)[];
  title: string;
  values: Values;
};

class DialogManager<P extends Props = Props, S extends State = State> extends Component<
  P,
  S
> {
  state = this.getDefaultState();

  componentDidMount() {
    this.validateForm();
  }

  componentDidUpdate(_prevProps: Props, prevState: S) {
    if (!isEqual(prevState.values, this.state.values)) {
      this.validateForm();
    }
    if (
      !isEqual(prevState.errors, this.state.errors) &&
      Object.keys(this.state.errors).length > 0
    ) {
      this.setValidForm(false);
    }
  }

  getDefaultState(): Readonly<S> {
    return {
      values: {name: '', publicKey: '', description: ''},
      requiredValues: ['name', 'publicKey'],
      errors: {},
      disables: {},
      isFormValid: false,
      title: this.getTitle(),
    } as Readonly<S>;
  }

  getTitle(): string {
    return '';
  }

  getData(): {trustedRelays: Relay[]} {
    // Child has to implement this
    throw new Error('Not implemented');
  }

  getBtnSaveLabel(): string | undefined {
    return undefined;
  }

  setValidForm(isFormValid: boolean) {
    this.setState({isFormValid});
  }

  validateForm() {
    const {values, requiredValues, errors} = this.state;

    const isFormValid = requiredValues.every(
      requiredValue =>
        !!values[requiredValue].replace(/\s/g, '') && !errors[requiredValue]
    );

    this.setValidForm(isFormValid);
  }

  clearError<F extends keyof Values>(field: F) {
    this.setState(prevState => ({
      errors: omit(prevState.errors, field),
    }));
  }

  handleErrorResponse(error: ReturnType<typeof createTrustedRelaysResponseError>) {
    switch (error.type) {
      case 'invalid-key':
      case 'missing-key':
        this.setState(prevState => ({
          errors: {...prevState.errors, publicKey: error.message},
        }));
        break;
      case 'empty-name':
      case 'missing-name':
        this.setState(prevState => ({
          errors: {...prevState.errors, name: error.message},
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  handleChange = <F extends keyof Values>(field: F, value: Values[F]) => {
    this.setState(prevState => ({
      values: {
        ...prevState.values,
        [field]: value,
      },
      errors: omit(prevState.errors, field),
    }));
  };

  handleSave = async () => {
    const {onSubmitSuccess, closeModal, orgSlug, api} = this.props;

    const trustedRelays = this.getData().trustedRelays.map(trustedRelay =>
      omit(trustedRelay, ['created', 'lastModified'])
    );

    try {
      const response = await api.requestPromise(`/organizations/${orgSlug}/`, {
        method: 'PUT',
        data: {trustedRelays},
      });
      onSubmitSuccess(response);
      closeModal();
    } catch (error) {
      this.handleErrorResponse(createTrustedRelaysResponseError(error));
    }
  };

  handleValidate =
    <F extends keyof Values>(field: F) =>
    () => {
      const isFieldValueEmpty = !this.state.values[field].replace(/\s/g, '');

      const fieldErrorAlreadyExist = this.state.errors[field];

      if (isFieldValueEmpty && fieldErrorAlreadyExist) {
        return;
      }

      if (isFieldValueEmpty && !fieldErrorAlreadyExist) {
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            [field]: t('Field Required'),
          },
        }));
        return;
      }

      if (!isFieldValueEmpty && fieldErrorAlreadyExist) {
        this.clearError(field);
      }
    };

  handleValidateKey = () => {
    const {savedRelays} = this.props;
    const {values, errors} = this.state;
    const isKeyAlreadyTaken = savedRelays.find(
      savedRelay => savedRelay.publicKey === values.publicKey
    );

    if (isKeyAlreadyTaken && !errors.publicKey) {
      this.setState({
        errors: {
          ...errors,
          publicKey: t('Relay key already taken'),
        },
      });
      return;
    }

    if (errors.publicKey) {
      this.setState({
        errors: omit(errors, 'publicKey'),
      });
    }

    this.handleValidate('publicKey')();
  };

  getForm() {
    const {values, errors, disables, isFormValid} = this.state;
    return (
      <Form
        isFormValid={isFormValid}
        onSave={this.handleSave}
        onChange={this.handleChange}
        onValidate={this.handleValidate}
        onValidateKey={this.handleValidateKey}
        errors={errors}
        values={values}
        disables={disables}
      />
    );
  }

  getContent(): React.ReactElement {
    return this.getForm();
  }

  render() {
    const {title, isFormValid} = this.state;
    const btnSaveLabel = this.getBtnSaveLabel();
    const content = this.getContent();

    return (
      <Modal
        {...this.props}
        title={title}
        onSave={this.handleSave}
        btnSaveLabel={btnSaveLabel}
        disabled={!isFormValid}
        content={content}
      />
    );
  }
}

export default DialogManager;
