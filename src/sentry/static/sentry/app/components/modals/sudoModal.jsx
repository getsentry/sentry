import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from '../../locale';
import ApiForm from '../forms/apiForm';
import ApiMixin from '../../mixins/apiMixin';
import LoadingIndicator from '../loadingIndicator';
import SimplePasswordField from '../forms/simplePasswordField';
import U2fContainer from '../u2fContainer';

class SudoModal extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    closeModal: PropTypes.func.isRequired,
    /**
     * expects a function that returns a Promise
     */
    retryRequest: PropTypes.func.isRequired,

    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      error: false,
      busy: false,
    };
  }

  handleSubmit = () => {
    this.setState({busy: true});
  };

  handleSuccess = () => {
    let {closeModal, retryRequest} = this.props;
    if (!retryRequest) return;

    this.setState(
      {
        busy: true,
      },
      () => {
        retryRequest().then(() => {
          this.setState(
            {
              busy: false,
            },
            closeModal
          );
        });
      }
    );
  };

  handleError = () => {
    this.setState({
      busy: false,
      error: true,
    });
  };

  handleU2fTap = data => {
    this.setState({busy: true});
    // u2Interface expects this to return a promise
    return this.props.api
      .requestPromise('/sudo/', {
        method: 'POST',
        data,
      })
      .then(() => {
        this.handleSuccess();
      })
      .catch(err => {
        this.setState({busy: false});

        // u2fInterface relies on this
        throw err;
      });
  };

  render() {
    let {closeModal, Header, Body} = this.props;

    return (
      <ApiForm
        apiMethod="POST"
        apiEndpoint="/sudo/"
        footerClass="modal-footer"
        submitLabel={t('Continue')}
        onSubmit={this.handleSubmit}
        onSubmitSuccess={this.handleSuccess}
        onSubmitError={this.handleError}
        hideErrors
        resetOnError
      >
        <Header closeButton onHide={closeModal}>
          {t('Confirm Your Identity')}
        </Header>

        <Body>
          {this.state.busy && <LoadingIndicator overlay />}
          <p>{t('Help us keep your account safe by confirming your identity.')}</p>
          {this.state.error && (
            <div className="alert alert-error alert-block">{t('Incorrect password')}</div>
          )}

          <SimplePasswordField label={t('Password')} required name="password" />

          <U2fContainer displayMode="sudo" onTap={this.handleU2fTap} />
        </Body>
      </ApiForm>
    );
  }
}

const SudoModalContainer = createReactClass({
  displayName: 'SudoModalContainer',
  mixins: [ApiMixin],

  render() {
    return <SudoModal {...this.props} api={this.api} />;
  },
});

export default SudoModalContainer;
export {SudoModal};
