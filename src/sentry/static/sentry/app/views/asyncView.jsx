import DocumentTitle from 'react-document-title';
import idx from 'idx';
import Modal from 'react-bootstrap/lib/Modal';
import React from 'react';

import AsyncComponent from '../components/asyncComponent';
import Button from '../components/buttons/button';
import ConfigStore from '../stores/configStore';
import {ApiForm, PasswordField} from '../components/forms';
import {t} from '../locale';

export default class AsyncView extends AsyncComponent {
  getTitle() {
    return '';
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      needsVerification: false,
    };
  }

  handleError(error, ...args) {
    if (idx(error, _ => _.responseJSON.needsSuperuser)) {
      // we should prompt somehow and maintain loading state
      return this.setState({
        needsVerification: true,
      });
    } else {
      return super.handleError(error, ...args);
    }
  }

  renderVerifyModal() {
    let user = ConfigStore.get('user');
    let location = this.props.location || {pathname: ''};
    return (
      <Modal show={this.state.needsVerification} animation={false}>
        <div className="modal-header">
          <h4>{t('Confirm Your Identity')}</h4>
        </div>
        <div className="modal-body">
          {user.hasPasswordAuth ? (
            <ApiForm
              apiMethod="PUT"
              apiEndpoint="/auth/"
              onSubmitSuccess={this.remountComponent.bind(this)}
              submitLoadingMessage={t('Please wait...')}
              submitErrorMessage={t('Unable to validate your credentials.')}
              submitLabel={t('Continue')}
            >
              <p>{t('Help us keep your account safe by confirming your identity.')}</p>
              <PasswordField label="Password" placeholder="Password" name="password" />
            </ApiForm>
          ) : (
            <div>
              <p>You will need to reauthenticate to continue.</p>
              <Button
                priority="primary"
                href={`/auth/login/?next=${encodeURIComponent(location.pathname)}`}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  render() {
    let title = this.getTitle();
    return (
      <DocumentTitle title={`${title ? `${title} - ` : ''}Sentry`}>
        {this.renderComponent()}
      </DocumentTitle>
    );
  }
}
