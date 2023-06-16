import {Component} from 'react';
import styled from '@emotion/styled';
import trimEnd from 'lodash/trimEnd';

import {logout} from 'sentry/actionCreators/account';
import {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import U2fContainer from 'sentry/components/u2f/u2fContainer';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Authenticator} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type OnTapProps = NonNullable<React.ComponentProps<typeof U2fContainer>['onTap']>;

type Props = {
  api: Client;
};

type State = {
  authenticators: Array<Authenticator>;
  error: boolean;
  errorType: string;
  showAccessForms: boolean;
  superuserAccessCategory: string;
  superuserReason: string;
};

class SuperuserAccessForm extends Component<Props, State> {
  state: State = {
    authenticators: [],
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
    const {api} = this.props;
    const {superuserAccessCategory, superuserReason, authenticators} = this.state;
    const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');

    const suAccessCategory = superuserAccessCategory || data.superuserAccessCategory;

    const suReason = superuserReason || data.superuserReason;

    if (!authenticators.length && !disableU2FForSUForm) {
      this.handleError(ErrorCodes.NO_AUTHENTICATOR);
      return;
    }

    if (this.state.showAccessForms && !disableU2FForSUForm) {
      this.setState({
        showAccessForms: false,
        superuserAccessCategory: suAccessCategory,
        superuserReason: suReason,
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

  handleU2fTap = async (data: Parameters<OnTapProps>[0]) => {
    const {api} = this.props;
    try {
      data.isSuperuserModal = true;
      data.superuserAccessCategory = this.state.superuserAccessCategory;
      data.superuserReason = this.state.superuserReason;
      await api.requestPromise('/auth/', {method: 'PUT', data});
      this.handleSuccess();
    } catch (err) {
      this.setState({showAccessForms: true});
      // u2fInterface relies on this
      throw err;
    }
  };

  handleSuccess = () => {
    window.location.reload();
  };

  handleError = err => {
    let errorType = '';
    if (err.status === 403) {
      if (err.responseJSON.detail.code === 'no_u2f') {
        errorType = ErrorCodes.NO_AUTHENTICATOR;
      } else {
        errorType = ErrorCodes.INVALID_PASSWORD;
      }
    } else if (err.status === 401) {
      errorType = ErrorCodes.INVALID_SSO_SESSION;
    } else if (err.status === 400) {
      errorType = ErrorCodes.INVALID_ACCESS_CATEGORY;
    } else if (err === ErrorCodes.NO_AUTHENTICATOR) {
      errorType = ErrorCodes.NO_AUTHENTICATOR;
    } else {
      errorType = ErrorCodes.UNKNOWN_ERROR;
    }
    this.setState({
      error: true,
      errorType,
      showAccessForms: true,
    });
  };

  handleLogout = async () => {
    const {api} = this.props;
    try {
      await logout(api);
    } catch {
      // ignore errors
    }
    const authLoginPath = `/auth/login/?next=${encodeURIComponent(window.location.href)}`;
    const {superuserUrl} = window.__initialData.links;
    if (window.__initialData?.customerDomain && superuserUrl) {
      const redirectURL = `${trimEnd(superuserUrl, '/')}${authLoginPath}`;
      window.location.assign(redirectURL);
      return;
    }
    window.location.assign(authLoginPath);
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

  render() {
    const {authenticators, error, errorType, showAccessForms} = this.state;
    if (errorType === ErrorCodes.INVALID_SSO_SESSION) {
      this.handleLogout();
      return null;
    }
    return (
      <ThemeAndStyleProvider>
        <Form
          submitLabel={t('Continue')}
          onSubmit={this.handleSubmit}
          initialData={{isSuperuserModal: true}}
          extraButton={
            <BackWrapper>
              <Button type="submit" onClick={this.handleSubmitCOPS}>
                {t('COPS/CSM')}
              </Button>
            </BackWrapper>
          }
          resetOnError
        >
          {error && (
            <StyledAlert type="error" showIcon>
              {errorType}
            </StyledAlert>
          )}
          {showAccessForms && <Hook name="component:superuser-access-category" />}
          {!showAccessForms && (
            <U2fContainer
              authenticators={authenticators}
              displayMode="sudo"
              onTap={this.handleU2fTap}
            />
          )}
        </Form>
      </ThemeAndStyleProvider>
    );
  }
}

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const BackWrapper = styled('div')`
  width: 100%;
  margin-left: ${space(4)};
`;

export default withApi(SuperuserAccessForm);
