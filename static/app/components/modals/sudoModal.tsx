import {Component, Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import InputField from 'sentry/components/forms/inputField';
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
  superuserAccessCategory: string;
  superuserReason: string;
};

class SudoModal extends Component<Props, State> {
  state: State = {
    error: false,
    errorType: '',
    busy: false,
    superuserAccessCategory: '',
    superuserReason: '',
    authenticators: [],
  };

  componentDidMount() {
    this.getAuthenticators();
  }

  handleSubmit = async () => {
    const {api, isSuperuser} = this.props;
    const data = {
      isSuperuserModal: isSuperuser,
      superuserAccessCategory: 'cops_csm',
      superuserReason: 'COPS and CSM use',
    };
    try {
      await api.requestPromise('/auth/', {method: 'PUT', data});
      this.handleSuccess();
    } catch (err) {
      this.handleError(err);
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
    const {authenticators, error, errorType} = this.state;
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
              extraButton={
                <BackWrapper>
                  <Button onClick={this.handleSubmit}>{t('COPS/CSM')}</Button>
                </BackWrapper>
              }
              resetOnError
            >
              {!isSelfHosted && <Hook name="component:superuser-access-category" />}
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
            {t(errorType)}
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
            <StyledInputField
              type="password"
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

const StyledInputField = styled(InputField)`
  padding-left: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const BackWrapper = styled('div')`
  width: 100%;
  margin-left: ${space(4)};
`;
