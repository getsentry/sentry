import {Component} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';

import Button from './button';

type Props = {
  api: Client;
};

type State = {
  error: boolean;
  errorType: string;
};

class SuperuserAccessForm extends Component<Props, State> {
  state: State = {
    error: false,
    errorType: '',
  };

  handleSubmit = async () => {
    const {api} = this.props;
    const data = {
      isSuperuserModal: true,
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
    window.location.reload();
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
      error: true,
      errorType,
    });
  };

  handleLogout = async () => {
    const {api} = this.props;
    try {
      await logout(api);
    } catch {
      // ignore errors
    }
    window.location.assign('/auth/login/');
  };

  render() {
    const {error, errorType} = this.state;
    if (errorType === ErrorCodes.invalidSSOSession) {
      this.handleLogout();
      return null;
    }
    return (
      <ThemeAndStyleProvider>
        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={t('Continue')}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          initialData={{isSuperuserModal: true}}
          extraButton={
            <BackWrapper>
              <Button onClick={this.handleSubmit}>{t('COPS/CSM')}</Button>
            </BackWrapper>
          }
          resetOnError
        >
          {error && (
            <StyledAlert type="error" showIcon>
              {t(errorType)}
            </StyledAlert>
          )}
          <Hook name="component:superuser-access-category" />
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
