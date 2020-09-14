import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import Form from 'app/views/settings/components/forms/form';
import InputField from 'app/views/settings/components/forms/inputField';
import {IconFlag} from 'app/icons';
import TextBlock from 'app/views/settings/components/text/textBlock';
import U2fContainer from 'app/components/u2f/u2fContainer';
import space from 'app/styles/space';

class SudoModal extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    closeModal: PropTypes.func.isRequired,
    /**
     * expects a function that returns a Promise
     */
    retryRequest: PropTypes.func,

    // User is a superuser without an active su session
    superuser: PropTypes.bool,
    router: PropTypes.object,
    user: PropTypes.object,

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

  handleSuccess = () => {
    const {closeModal, superuser, router, retryRequest} = this.props;

    if (!retryRequest) {
      closeModal();
      return;
    }

    if (superuser) {
      router.replace({...router.getCurrentLocation(), state: {forceUpdate: new Date()}});
      return;
    }

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
      .requestPromise('/auth/', {
        method: 'PUT',
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
    const {closeModal, superuser, user, Header, Body} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Confirm Password to Continue')}
        </Header>

        <Body>
          {!user.hasPasswordAuth ? (
            <div>
              <TextBlock>{t('You will need to reauthenticate to continue.')}</TextBlock>
              <Button
                priority="primary"
                href={`/auth/login/?next=${encodeURIComponent(location.pathname)}`}
              >
                {t('Continue')}
              </Button>
            </div>
          ) : (
            <React.Fragment>
              <TextBlock css={{marginBottom: space(1)}}>
                {superuser
                  ? t(
                      'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                    )
                  : t('Help us keep your account safe by confirming your identity.')}
              </TextBlock>

              {this.state.error && (
                <Alert css={{marginBottom: 0}} type="error" icon={<IconFlag size="md" />}>
                  {t('Incorrect password')}
                </Alert>
              )}

              <Form
                apiMethod="PUT"
                apiEndpoint="/auth/"
                submitLabel={t('Confirm Password')}
                onSubmit={this.handleSubmit}
                onSubmitSuccess={this.handleSuccess}
                onSubmitError={this.handleError}
                hideErrors
                resetOnError
                hideFooter={!user.hasPasswordAuth}
              >
                <InputField
                  autoFocus
                  type="password"
                  inline={false}
                  label={t('Password')}
                  flexibleControlStateSize
                  name="password"
                  css={{
                    paddingLeft: 0,
                    paddingRight: 0,
                    borderBottom: 'none',
                  }}
                />
                <U2fContainer displayMode="sudo" onTap={this.handleU2fTap} />
              </Form>
            </React.Fragment>
          )}
        </Body>
      </React.Fragment>
    );
  }
}

const SudoModalContainer = createReactClass({
  displayName: 'SudoModalContainer',

  render() {
    const user = ConfigStore.get('user');
    return <SudoModal {...this.props} user={user} />;
  },
});

export default withApi(withRouter(SudoModalContainer));
export {SudoModal};
