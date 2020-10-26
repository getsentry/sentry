import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {t} from 'app/locale';
import TextareaField from 'app/views/settings/components/forms/textareaField';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

import RequestIntegrationButton from './RequestIntegrationButton';

type Props = {
  onSuccess: () => void;
} & RequestIntegrationButton['props'] &
  ModalRenderProps &
  AsyncComponent['props'];
type State = {
  isSending: boolean;
  message: string;
} & AsyncComponent['state'];

/**
 * This modal serves as a non-owner's confirmation step before sending
 * organization owners an email requesting a new organization integration. It
 * lets the user attach an optional message to be included in the email.
 */
export default class RequestIntegrationModal extends AsyncComponent<Props, State> {
  state = {
    ...this.getDefaultState(),
    isSending: false,
    message: '',
  };

  sendRequest = () => {
    const {organization, slug, type} = this.props;
    const {message} = this.state;

    trackIntegrationEvent(
      {
        eventKey: 'integrations.request_install',
        eventName: 'Integrations: Request Install',
        integration_type: type,
        integration: slug,
      },
      organization
    );

    const endpoint = `/organizations/${organization.slug}/integration-requests/`;
    this.api.request(endpoint, {
      method: 'POST',
      data: {
        providerSlug: slug,
        providerType: type,
        message,
      },
      success: this.handleSubmitSuccess,
      error: this.handleSubmitError,
    });
  };

  handleSubmitSuccess = () => {
    const {closeModal, onSuccess} = this.props;

    addSuccessMessage(t('Request successfully sent.'));
    this.setState({isSending: false});
    onSuccess();
    closeModal();
  };

  handleSubmitError = () => {
    addErrorMessage('Error sending the request');
    this.setState({isSending: false});
  };

  render() {
    const {Header, Body, Footer, name} = this.props;

    const buttonText = this.state.isSending ? t('Sending Request') : t('Send Request');

    return (
      <React.Fragment>
        <Header>
          <h4>{t('Request %s Installation', name)}</h4>
        </Header>
        <Body>
          <TextBlock>
            {t(
              'Looks like your organization owner, manager, or admin needs to install %s. Want to send them a request?',
              name
            )}
          </TextBlock>
          <TextBlock>
            {t(
              '(Optional) You’ve got good reasons for installing the %s Integration. Share them with your organization owner.',
              name
            )}
          </TextBlock>
          <TextareaField
            inline={false}
            flexibleControlStateSize
            stacked
            name="message"
            type="string"
            onChange={value => this.setState({message: value})}
            placeholder={t('Optional message…')}
          />
          <TextBlock>
            {t(
              'When you click “Send Request”, we’ll email your request to your organization’s owners. So just keep that in mind.'
            )}
          </TextBlock>
        </Body>
        <Footer>
          <Button onClick={this.sendRequest}>{buttonText}</Button>
        </Footer>
      </React.Fragment>
    );
  }
}
