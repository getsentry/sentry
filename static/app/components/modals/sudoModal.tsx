import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
// import Button from 'sentry/components/button';
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
  isFirstStep: boolean;
};

class SudoModal extends React.Component<Props, State> {
  state: State = {
    error: false,
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
        this.handleError();
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

  handleError = () => {
    this.setState({busy: false, error: true, isFirstStep: true});
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
    const {error, isFirstStep} = this.state;
    const user = ConfigStore.get('user');
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
          <Form
            apiMethod="PUT"
            apiEndpoint="/auth/"
            submitLabel={t('Re-authenticate')}
            onSubmitSuccess={this.handleSuccess}
            onSubmitError={this.handleError}
            resetOnError
          >
            {/* only show the 2 below if they are superusers */}
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
            <StyledInputField
              type="text"
              inline={false}
              label={t('Reason for Superuser')}
              name="superuserReason"
              flexibleControlStateSize
              required
            />
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
            {t('Incorrect password')}
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
          {isFirstStep && superuser && (
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
          {isFirstStep && superuser && (
            <StyledInputField
              type="text"
              inline={false}
              label={t('Reason for Superuser')}
              name="superuserReason"
              flexibleControlStateSize
              required
            />
          )}
          {((!isFirstStep && superuser) || !superuser) && (
            <StyledInputField
              type="password"
              inline={false}
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}
          {((!isFirstStep && superuser) || !superuser) && (
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
