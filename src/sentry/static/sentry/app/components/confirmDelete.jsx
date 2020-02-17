import React from 'react';
import PropTypes from 'prop-types';
import Confirm from 'app/components/confirm';
import Alert from 'app/components/alert';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import {t} from 'app/locale';

class ConfirmDelete extends React.PureComponent {
  static propTypes = {
    onConfirm: PropTypes.func.isRequired,
    confirmText: PropTypes.string.isRequired,
    confirmInput: PropTypes.string.isRequired,
    cancelText: PropTypes.string.isRequired,
    priority: PropTypes.oneOf(['primary', 'danger']).isRequired,
    message: PropTypes.node,
    /**
     * Renderer that passes:
     * `confirm`: Allows renderer to perform confirm action
     * `close`: Allows renderer to toggle confirm modal
     */
    renderMessage: PropTypes.func,
    disabled: PropTypes.bool,
    onConfirming: PropTypes.func,
    onCancel: PropTypes.func,
  };

  static defaultProps = {
    priority: 'primary',
    cancelText: t('Cancel'),
    confirmText: t('Confirm'),
  };

  constructor(...args) {
    super(...args);

    this.state = {
      disableConfirmButton: true,
      confirmInput: '',
    };
  }

  handleChange = evt => {
    const input = evt.target.value;
    if (input === this.props.confirmInput) {
      this.setState({disableConfirmButton: false, confirmInput: input});
    } else {
      this.setState({disableConfirmButton: true, confirmInput: input});
    }
  };

  render() {
    const {confirmInput, message, ...props} = this.props;
    const {disableConfirmButton} = this.state;

    return (
      <Confirm
        {...props}
        bypass={false}
        disableConfirmButton={disableConfirmButton}
        message={
          <React.Fragment>
            <Alert type="error">{message}</Alert>
            <Field
              p={0}
              flexibleControlStateSize
              inline={false}
              label={
                <div>
                  Please enter <code>{confirmInput}</code> to confirm the deletion
                </div>
              }
            >
              <Input
                type="text"
                placeholder={confirmInput}
                onChange={this.handleChange}
                value={this.state.confirmInput}
              />
            </Field>
          </React.Fragment>
        }
      />
    );
  }
}

export default ConfirmDelete;
