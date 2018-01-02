import {browserHistory} from 'react-router';
import Modal from 'react-bootstrap/lib/Modal';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';

import {t} from '../../locale';
import ApiForm from '../forms/apiForm';
import ApiMixin from '../../mixins/apiMixin';
import LoadingIndicator from '../loadingIndicator';
import SimplePasswordField from '../forms/simplePasswordField';
import SudoActions from '../../actions/sudoActions';
import SudoModalStore from '../../stores/sudoModalStore';
import U2fContainer from '../u2fContainer';

const SudoModal = React.createClass({
  mixins: [ApiMixin, Reflux.connect(SudoModalStore, 'modalProps')],

  getInitialState() {
    return {
      modalProps: false,
      error: false,
      busy: false,
    };
  },

  componentDidMount() {
    // Listen for route changes so we can dismiss modal
    this.unlisten = browserHistory.listen(() =>
      this.setState({
        modalProps: false,
      })
    );
  },

  componentWillUnmount() {
    if (this.unlisten) {
      this.unlisten();
    }
  },

  handleSubmit() {
    this.setState({busy: true});
  },

  handleSuccess() {
    if (!this.state.modalProps || !this.state.modalProps.retryRequest) return;

    this.setState(
      {
        busy: true,
      },
      () => {
        if (!this.state.modalProps) return;

        this.state.modalProps.retryRequest().then(() => {
          this.setState(
            {
              busy: false,
            },
            SudoActions.closeModal
          );
        });
      }
    );
  },

  handleError() {
    this.setState({
      busy: false,
      error: true,
    });
  },

  handleU2fTap(data) {
    this.setState({busy: true});
    // u2Interface expects this to return a promise
    return this.api
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
  },

  render() {
    let {className} = this.props;
    let cx = classNames('sudo-modal', className);
    let showModal = !!this.state.modalProps;

    return (
      <Modal
        className={cx}
        show={showModal}
        animation={false}
        onHide={SudoActions.closeModal}
      >
        {showModal && (
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
            <Modal.Header closeButton onHide={SudoActions.closeModal}>
              {t('Confirm Your Identity')}
            </Modal.Header>

            <Modal.Body>
              {this.state.busy && <LoadingIndicator overlay />}
              <p>{t('Help us keep your account safe by confirming your identity.')}</p>
              {this.state.error && (
                <div className="alert alert-error alert-block">
                  {t('Incorrect password')}
                </div>
              )}

              <SimplePasswordField label={t('Password')} required name="password" />

              <U2fContainer displayMode="sudo" onTap={this.handleU2fTap} />
            </Modal.Body>
          </ApiForm>
        )}
      </Modal>
    );
  },
});

export default SudoModal;
