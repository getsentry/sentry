import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import InputField from 'sentry/components/forms/inputField';
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
};

class SudoModal extends React.Component<Props, State> {
  state: State = {
    error: false,
    busy: false,
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

    this.setState({busy: true}, () => {
      retryRequest().then(() => {
        this.setState({busy: false}, closeModal);
      });
    });
  };

  handleError = () => {
    this.setState({busy: false, error: true});
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
    const {error} = this.state;
    const user = ConfigStore.get('user');
    if (!user.hasPasswordAuth) {
      return (
        <React.Fragment>
          <TextBlock>{t('You will need to reauthenticate to continue.')}</TextBlock>
          <Button
            priority="primary"
            href={`/auth/login/?next=${encodeURIComponent(location.pathname)}`}
          >
            {t('Continue')}
          </Button>
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
          submitLabel={t('Confirm Password')}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={this.handleError}
          hideFooter={!user.hasPasswordAuth}
          resetOnError
        >
          <StyledInputField
            type="password"
            inline={false}
            label={t('Password')}
            name="password"
            autoFocus
            flexibleControlStateSize
          />
          <U2fContainer displayMode="sudo" onTap={this.handleU2fTap} />
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
