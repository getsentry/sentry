import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import InputField from 'sentry/components/forms/inputField';
import SelectField from 'sentry/components/forms/selectField';
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
     * expects a function that returns a Promise
     */
    retryRequest?: () => Promise<any>;
    /**
     * User is a superuser without an active su session
     */
    superuser?: boolean;
  };

type State = {
  busy: boolean;
  error: boolean;
  errorType: string;
  isFirstStep: boolean;
};

class SudoModal extends React.Component<Props, State> {
  state: State = {
    error: false,
    errorType: '',
    busy: false,
    isFirstStep: true,
  };

  handleSubmit = async data => {
    const {api, superuser} = this.props;

    if (this.state.isFirstStep && superuser) {
      this.setState({isFirstStep: false});
    } else {
      try {
        data.isSuperuserModal = superuser;
        await api.requestPromise('/auth/', {method: 'PUT', data});
        this.handleSuccess();
      } catch (err) {
        this.handleError(err);
      }
    }
  };

  handleSuccess = () => {
    const {closeModal, superuser, location, router, retryRequest} = this.props;

    if (!retryRequest) {
      closeModal();
      return;
    }

    if (superuser) {
      router.replace({pathname: location.pathname, state: {forceUpdate: new Date()}});
      return;
    }

    this.setState({busy: true, isFirstStep: true}, () => {
      retryRequest().then(() => {
        this.setState({busy: false}, closeModal);
      });
    });
  };

  handleError = err => {
    let errType = '';
    if (err.status === 403) {
      errType = 'invalidPassword';
    } else if (err.status === 401) {
      errType = 'invalidSSOSession';
    } else if (
      err.responseText ===
      '{"superuserReason":["Ensure this field has at least 4 characters."]}'
    ) {
      errType = 'invalidReason';
    }
    this.setState({busy: false, error: true, isFirstStep: true, errorType: errType});
  };

  handleU2fTap = async (data: Parameters<OnTapProps>[0]) => {
    this.setState({busy: true});

    const {api} = this.props;

    try {
      await api.requestPromise('/auth/', {method: 'PUT', data});
      this.handleSuccess();
    } catch (err) {
      this.setState({busy: false});
      // u2fInterface relies on this
      throw err;
    }
  };

  renderBodyContent() {
    const {superuser} = this.props;
    const {error, isFirstStep, errorType} = this.state;
    const user = ConfigStore.get('user');
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    const placeholderForSUCategories = [
      {value: '1', name: 'a'},
      {value: '2', name: 'b'},
    ];
    if (!user.hasPasswordAuth) {
      return (
        <React.Fragment>
          <StyledTextBlock>
            {superuser
              ? t(
                  'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                )
              : t('You will need to reauthenticate to continue')}
          </StyledTextBlock>
          {error && (
            <StyledAlert type="error" icon={<IconFlag size="md" />}>
              {errorType === 'invalidPassword'
                ? t('Incorrect password')
                : errorType === 'invalidReason'
                ? t(
                    'Please make sure your reason for access is between 4 to 128 characters'
                  )
                : errorType === 'invalidSSOSession'
                ? t('Your SSO Session has expired, please reauthnticate')
                : t('An error ocurred, please try again')}
            </StyledAlert>
          )}
          <Form
            apiMethod="PUT"
            apiEndpoint="/auth/"
            submitLabel={t('Re-authenticate')}
            onSubmitSuccess={this.handleSuccess}
            onSubmitError={this.handleError}
            resetOnError
          >
            {!isSelfHosted && isFirstStep && superuser && (
              <StyledSelectField
                name="superuserAccessCategory"
                label={t('Catergory of Superuser Access')}
                options={placeholderForSUCategories.map(SUCategory => ({
                  value: SUCategory.value,
                  label: SUCategory.name,
                }))}
                placeholder={t('Select Catergory')}
                inline={false}
                flexibleControlStateSize
                required
              />
            )}
            {!isSelfHosted && isFirstStep && superuser && (
              <StyledInputField
                type="text"
                inline={false}
                label={t('Reason for Superuser')}
                name="superuserReason"
                flexibleControlStateSize
                required
              />
            )}
          </Form>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <StyledTextBlock>
          {superuser
            ? t(
                'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
              )
            : t('Help us keep your account safe by confirming your identity.')}
        </StyledTextBlock>

        {error && (
          <StyledAlert type="error" icon={<IconFlag size="md" />}>
            {errorType === 'invalidPassword'
              ? t('Incorrect password')
              : errorType === 'invalidReason'
              ? t(
                  'Please make sure your reason for access is between 4 to 128 characters'
                )
              : errorType === 'invalidSSOSession'
              ? t('Your SSO Session has expired, please reauthnticate')
              : t('An error ocurred, please try again')}
          </StyledAlert>
        )}

        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={isFirstStep ? t('Continue') : t('Confirm Password')}
          onSubmit={this.handleSubmit}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          hideFooter={!user.hasPasswordAuth}
          resetOnError
        >
          {!isSelfHosted && isFirstStep && superuser && (
            <StyledSelectField
              name="superuserAccessCategory"
              label={t('Catergory of Superuser Access')}
              options={placeholderForSUCategories.map(SUCategory => ({
                value: SUCategory.value,
                label: SUCategory.name,
              }))}
              placeholder={t('Select Catergory')}
              inline={false}
              flexibleControlStateSize
              required
            />
          )}
          {!isSelfHosted && isFirstStep && superuser && (
            <StyledInputField
              type="text"
              inline={false}
              label={t('Reason for Superuser')}
              name="superuserReason"
              flexibleControlStateSize
              required
            />
          )}
          {((!isFirstStep && superuser) || !superuser || isSelfHosted) && (
            <StyledInputField
              type="password"
              inline={false}
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}
          {((!isFirstStep && superuser) || !superuser || isSelfHosted) && (
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

const StyledSelectField = styled(SelectField)`
  padding-left: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;
