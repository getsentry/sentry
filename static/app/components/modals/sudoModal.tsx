import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import InputField from 'sentry/components/forms/inputField';
import Hook from 'sentry/components/hook';
import U2fContainer from 'sentry/components/u2f/u2fContainer';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type OnTapProps = NonNullable<React.ComponentProps<typeof U2fContainer>['onTap']>;

type Props = WithRouterProps &
  Pick<ModalRenderProps, 'Body' | 'Header'> & {
    api: Client;
    closeModal: () => void;
    /**
     * User is a superuser without an active su session
     */
    isSuperuser?: boolean;
    /**
     * expects a function that returns a Promise
     */
    retryRequest?: () => Promise<any>;
  };

type State = {
  busy: boolean;
  error: boolean;
  errorType: string;
  showAccessForms: boolean;
  superuserAccessCategory: string;
  superuserReason: string;
};

enum ErrorCodes {
  invalidPassword = 'Incorrect password',
  invalidSSOSession = 'Your SSO Session has expired, please reauthnticate',
  invalidAccessCategory = 'Please fill out the access category and reason correctly',
  unknownError = 'An error ocurred, please try again',
}

class SudoModal extends React.Component<Props, State> {
  state: State = {
    error: false,
    errorType: '',
    busy: false,
    showAccessForms: true,
    superuserAccessCategory: '',
    superuserReason: '',
  };

  handleSubmit = async data => {
    const {api, isSuperuser} = this.props;

    if (this.state.showAccessForms && isSuperuser) {
      this.setState({
        showAccessForms: false,
        superuserAccessCategory: data.superuserAccessCategory,
        superuserReason: data.superuserReason,
      });
    } else {
      try {
        await api.requestPromise('/auth/', {method: 'PUT', data});
        this.handleSuccess();
      } catch (err) {
        this.handleError(err);
      }
    }
  };

  handleSuccess = () => {
    const {closeModal, isSuperuser, location, router, retryRequest} = this.props;

    if (!retryRequest) {
      closeModal();
      return;
    }

    if (isSuperuser) {
      router.replace({pathname: location.pathname, state: {forceUpdate: new Date()}});
      return;
    }

    this.setState({busy: true, showAccessForms: true}, () => {
      retryRequest().then(() => {
        this.setState({busy: false}, closeModal);
      });
    });
  };

  handleError = err => {
    let errorType = '';
    if (err.status === 403) {
      errorType = ErrorCodes.invalidPassword;
    } else if (err.status === 401) {
      errorType = ErrorCodes.invalidSSOSession;
    } else if (err.status === 400) {
      errorType = ErrorCodes.invalidAccessCategory;
    } else {
      errorType = ErrorCodes.unknownError;
    }
    this.setState({
      busy: false,
      error: true,
      showAccessForms: true,
      errorType,
    });
  };

  handleU2fTap = async (data: Parameters<OnTapProps>[0]) => {
    this.setState({busy: true});

    const {api, isSuperuser} = this.props;

    try {
      data.isSuperuserModal = isSuperuser;
      data.superuserAccessCategory = this.state.superuserAccessCategory;
      data.superuserReason = this.state.superuserReason;
      await api.requestPromise('/auth/', {method: 'PUT', data});
      this.handleSuccess();
    } catch (err) {
      this.setState({busy: false});
      // u2fInterface relies on this
      throw err;
    }
  };

  renderBodyContent() {
    const {isSuperuser} = this.props;
    const {error, showAccessForms, errorType} = this.state;
    const user = ConfigStore.get('user');
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    if (!user.hasPasswordAuth) {
      return (
        <React.Fragment>
          <StyledTextBlock>
            {isSuperuser
              ? t(
                  'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                )
              : t('You will need to reauthenticate to continue')}
          </StyledTextBlock>
          {error && (
            <StyledAlert type="error" icon={<IconFlag size="md" />}>
              {t(errorType)}
            </StyledAlert>
          )}
          {isSuperuser ? (
            <Form
              apiMethod="PUT"
              apiEndpoint="/auth/"
              submitLabel={t('Re-authenticate')}
              onSubmitSuccess={this.handleSuccess}
              onSubmitError={this.handleError}
              initialData={{isSuperuserModal: isSuperuser}}
              resetOnError
            >
              {!isSelfHosted && showAccessForms && isSuperuser && (
                <Hook name="component:superuser-access-category" />
              )}
            </Form>
          ) : (
            <Button
              priority="primary"
              href={`/auth/login/?next=${encodeURIComponent(location.pathname)}`}
            >
              {t('Continue')}
            </Button>
          )}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <StyledTextBlock>
          {isSuperuser
            ? t(
                'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
              )
            : t('Help us keep your account safe by confirming your identity.')}
        </StyledTextBlock>

        {error && (
          <StyledAlert type="error" icon={<IconFlag size="md" />}>
            {t(errorType)}
          </StyledAlert>
        )}

        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={showAccessForms ? t('Continue') : t('Confirm Password')}
          onSubmit={this.handleSubmit}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          hideFooter={!user.hasPasswordAuth}
          initialData={{isSuperuserModal: isSuperuser}}
          resetOnError
        >
          {!isSelfHosted && showAccessForms && isSuperuser && (
            <Hook name="component:superuser-access-category" />
          )}
          {((!showAccessForms && isSuperuser) || !isSuperuser || isSelfHosted) && (
            <StyledInputField
              type="password"
              inline={false}
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}
          {((!showAccessForms && isSuperuser) || !isSuperuser || isSelfHosted) && (
            <U2fContainer displayMode="sudo" onTap={this.handleU2fTap} />
          )}
        </Form>
      </React.Fragment>
    );
  }

  render() {
    const {Header, Body} = this.props;

    return (
      <React.Fragment>
        <Header closeButton>{t('Confirm Password to Continue')}</Header>
        <Body>{this.renderBodyContent()}</Body>
      </React.Fragment>
    );
  }
}

export default withRouter(withApi(SudoModal));
export {SudoModal};

const StyledTextBlock = styled(TextBlock)`
  margin-bottom: ${space(1)};
`;

const StyledInputField = styled(InputField)`
  padding-left: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;
