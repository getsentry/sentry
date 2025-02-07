import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import {t} from 'sentry/locale';
import type {IntegrationType} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  name: string;
  onSuccess: () => void;
  slug: string;
  type: IntegrationType;
} & ModalRenderProps;

/**
 * This modal serves as a non-owner's confirmation step before sending
 * organization owners an email requesting a new organization integration. It
 * lets the user attach an optional message to be included in the email.
 */
export default function RequestIntegrationModal(props: Props) {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const {Header, Body, Footer, name, slug, type, closeModal, onSuccess} = props;
  const endpoint = `/organizations/${organization.slug}/integration-requests/`;

  const sendRequestMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(endpoint, {
        method: 'POST',
        data: {
          providerSlug: slug,
          providerType: type,
          message,
        },
      });
    },
    onMutate: () => {
      setIsSending(true);
      trackIntegrationAnalytics('integrations.request_install', {
        integration_type: type,
        integration: slug,
        organization,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Request successfully sent.'));
      setIsSending(false);
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage('Error sending the request');
      setIsSending(false);
    },
  });

  const buttonText = isSending ? t('Sending Request') : t('Send Request');

  return (
    <Fragment>
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
          onChange={setMessage}
          placeholder={t('Optional message…')}
        />
        <TextBlock>
          {t(
            'When you click “Send Request”, we’ll email your request to your organization’s owners. So just keep that in mind.'
          )}
        </TextBlock>
      </Body>
      <Footer>
        <Button onClick={() => sendRequestMutation.mutate()}>{buttonText}</Button>
      </Footer>
    </Fragment>
  );
}
