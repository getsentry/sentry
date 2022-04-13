import {Component} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';

type State = {
  error: boolean;
  errorType: string;
};

class SuperuserAccessForm extends Component<State> {
  state: State = {
    error: false,
    errorType: '',
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

  render() {
    const {error, errorType} = this.state;
    return (
      <ThemeAndStyleProvider>
        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={t('Continue')}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          initialData={{isSuperuserModal: true}}
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

export default SuperuserAccessForm;
