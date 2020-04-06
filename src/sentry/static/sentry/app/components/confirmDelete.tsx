import React from 'react';

import Confirm from 'app/components/confirm';
import Alert from 'app/components/alert';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import {t} from 'app/locale';
import Button from 'app/components/button';

const defaultProps = {
  priority: 'primary' as React.ComponentProps<typeof Button>['priority'],
  cancelText: t('Cancel'),
  confirmText: t('Confirm'),
};

type Props = {
  onConfirm: () => void;
  confirmInput: string;
  message?: React.ReactNode;
  renderMessage?: React.ComponentProps<typeof Confirm>['renderMessage'];
  children?: React.ComponentProps<typeof Confirm>['children'];
  disabled?: boolean;
  onConfirming?: () => void;
  onCancel?: () => void;
} & typeof defaultProps;

type State = {
  disableConfirmButton: boolean;
  confirmInput: string;
};

class ConfirmDelete extends React.PureComponent<Props, State> {
  static defaultProps = defaultProps;

  state = {
    disableConfirmButton: true,
    confirmInput: '',
  };

  handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const input = evt.target.value;
    if (input === this.props.confirmInput) {
      this.setState({disableConfirmButton: false, confirmInput: input});
    } else {
      this.setState({disableConfirmButton: true, confirmInput: input});
    }
  };

  renderConfirmMessage = () => {
    const {message, confirmInput} = this.props;

    return (
      <React.Fragment>
        <Alert type="error">{message}</Alert>
        <Field
          flexibleControlStateSize
          inline={false}
          label={t(
            'Please enter %s to confirm the deletion',
            <code>{confirmInput}</code>
          )}
        >
          <Input
            type="text"
            placeholder={confirmInput}
            onChange={this.handleChange}
            value={this.state.confirmInput}
          />
        </Field>
      </React.Fragment>
    );
  };

  render() {
    const {disableConfirmButton} = this.state;

    return (
      <Confirm
        {...this.props}
        bypass={false}
        disableConfirmButton={disableConfirmButton}
        message={this.renderConfirmMessage()}
      />
    );
  }
}

export default ConfirmDelete;
