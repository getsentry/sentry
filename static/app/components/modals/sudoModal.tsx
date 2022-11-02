import {Component, Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import SecretField from 'sentry/components/forms/fields/secretField';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import U2fContainer from 'sentry/components/u2f/u2fContainer';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {Authenticator} from 'sentry/types';
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
    needsReload?: boolean;
    /**
     * expects a function that returns a Promise
     */
    retryRequest?: () => Promise<any>;
  };

type State = {
  authenticators: Array<Authenticator>;
  busy: boolean;
  error: boolean;
  errorType: string;
  showAccessForms: boolean;
  superuserAccessCategory: string;
  superuserReason: string;
};

class SudoModal extends Component<Props, State> {
  state: State = {
    authenticators: [],
    busy: false,
    error: false,
    errorType: '',
    showAccessForms: true,
    superuserAccessCategory: '',
    superuserReason: '',
  };

  componentDidMount() {
    this.getAuthenticators();
  }

  handleSubmitCOPS = () => {
    this.setState({
      superuserAccessCategory: 'cops_csm',
      superuserReason: 'COPS and CSM use',
    });
  };

  handleSubmit = async data => {
    const {api, isSuperuser} = this.props;
    const {superuserAccessCategory, superuserReason, authenticators} = this.state;
    const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');

    const suAccessCategory = superuserAccessCategory || data.superuserAccessCategory;

    const suReason = superuserReason || data.superuserReason;

    if (!authenticators.length && !disableU2FForSUForm) {
      this.handleError(ErrorCodes.noAuthenticator);
      return;
    }

    if (this.state.showAccessForms && isSuperuser && !disableU2FForSUForm) {
      this.setState({
        showAccessForms: false,
        superuserAccessCategory: suAccessCategory,
        superuserReason: suReason,
      });
    } else {
      if (isSuperuser) {
        this.handleSuccess();
      } else {
        try {
          await api.requestPromise('/auth/', {method: 'PUT', data});
          this.handleSuccess();
        } catch (err) {
          this.handleError(err);
        }
      }
    }
  };

  handleSuccess = () => {
    const {closeModal, isSuperuser, location, needsReload, router, retryRequest} =
      this.props;

    if (!retryRequest) {
      closeModal();
      return;
    }

    if (isSuperuser) {
      router.replace({pathname: location.pathname, state: {forceUpdate: new Date()}});
      if (needsReload) {
        window.location.reload();
      }
      return;
    }

    this.setState({busy: true}, () => {
      retryRequest().then(() => {
        this.setState({busy: false, showAccessForms: true}, closeModal);
      });
    });
  };

  handleError = err => {
    let errorType = '';
    if (err.status === 403) {
      if (err.responseJSON.detail.code === 'no_u2f') {
        errorType = ErrorCodes.noAuthenticator;
      } else {
        errorType = ErrorCodes.invalidPassword;
      }
    } else if (err.status === 401) {
      errorType = ErrorCodes.invalidSSOSession;
    } else if (err.status === 400) {
      errorType = ErrorCodes.invalidAccessCategory;
    } else if (err === ErrorCodes.noAuthenticator) {
      errorType = ErrorCodes.noAuthenticator;
    } else {
      errorType = ErrorCodes.unknownError;
    }
    this.setState({
      busy: false,
      error: true,
      errorType,
      showAccessForms: true,
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

  handleLogout = async () => {
    const {api} = this.props;
    try {
      await logout(api);
    } catch {
      // ignore errors
    }
    window.location.assign(`/auth/login/?next=${encodeURIComponent(location.pathname)}`);
  };

  async getAuthenticators() {
    const {api} = this.props;

    try {
      const authenticators = await api.requestPromise('/authenticators/');
      this.setState({authenticators: authenticators ?? []});
    } catch {
      // ignore errors
    }
  }

  renderBodyContent() {
    const {isSuperuser} = this.props;
    const {authenticators, error, errorType, showAccessForms} = this.state;
    const user = ConfigStore.get('user');
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    const validateSUForm = ConfigStore.get('validateSUForm');

    if (errorType === ErrorCodes.invalidSSOSession) {
      this.handleLogout();
      return null;
    }

    if (
      (!user.hasPasswordAuth && authenticators.length === 0) ||
      (isSuperuser && !isSelfHosted && validateSUForm)
    ) {
      return (
        <Fragment>
          <StyledTextBlock>
            {isSuperuser
              ? t(
                  'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                )
              : t('You will need to reauthenticate to continue')}
          </StyledTextBlock>
          {error && (
            <StyledAlert type="error" showIcon>
              {errorType}
            </StyledAlert>
          )}
          {isSuperuser ? (
            <Form
              apiMethod="PUT"
              apiEndpoint="/auth/"
              submitLabel={showAccessForms ? t('Continue') : t('Re-authenticate')}
              onSubmit={this.handleSubmit}
              onSubmitSuccess={this.handleSuccess}
              onSubmitError={this.handleError}
              initialData={{isSuperuserModal: isSuperuser}}
              extraButton={
                <BackWrapper>
                  <Button onClick={this.handleSubmitCOPS}>{t('COPS/CSM')}</Button>
                </BackWrapper>
              }
              resetOnError
            >
              {!isSelfHosted && showAccessForms && (
                <Hook name="component:superuser-access-category" />
              )}
              {!isSelfHosted && !showAccessForms && (
                <U2fContainer
                  authenticators={authenticators}
                  displayMode="sudo"
                  onTap={this.handleU2fTap}
                />
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
        </Fragment>
      );
    }

    return (
      <Fragment>
        <StyledTextBlock>
          {isSuperuser
            ? t(
                'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
              )
            : t('Help us keep your account safe by confirming your identity.')}
        </StyledTextBlock>

        {error && (
          <StyledAlert type="error" showIcon>
            {errorType}
          </StyledAlert>
        )}

        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={t('Confirm Password')}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          hideFooter={!user.hasPasswordAuth && authenticators.length === 0}
          initialData={{isSuperuserModal: isSuperuser}}
          resetOnError
        >
          {user.hasPasswordAuth && (
            <StyledSecretField
              inline={false}
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}

          <U2fContainer
            authenticators={authenticators}
            displayMode="sudo"
            onTap={this.handleU2fTap}
          />
        </Form>
      </Fragment>
    );
  }

  render() {
    const {Header, Body} = this.props;

    return (
      <Fragment>
        <Header closeButton>{t('Confirm Password to Continue')}</Header>
        <Body>{this.renderBodyContent()}</Body>
      </Fragment>
    );
  }
}

export default withRouter(withApi(SudoModal));
export {SudoModal};

const StyledTextBlock = styled(TextBlock)`
  margin-bottom: ${space(1)};
`;

const StyledSecretField = styled(SecretField)`
  padding-left: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const BackWrapper = styled('div')`
  width: 100%;
  margin-left: ${space(4)};
`;
