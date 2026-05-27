import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {IntegrationType} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

type Props = {
  name: string;
  onSuccess: () => void;
  slug: string;
  type: IntegrationType;
} & ModalRenderProps;

const schema = z.object({
  message: z.string(),
});

/**
 * This modal serves as a non-owner's confirmation step before sending
 * organization owners an email requesting a new organization integration. It
 * lets the user attach an optional message to be included in the email.
 */
export function RequestIntegrationModal(props: Props) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const {Header, Body, Footer, CloseButton, name, slug, type, closeModal, onSuccess} =
    props;
  const endpoint = `/organizations/${organization.slug}/integration-requests/`;

  const sendRequestMutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      api.requestPromise(endpoint, {
        method: 'POST',
        data: {
          providerSlug: slug,
          providerType: type,
          message: data.message,
        },
      }),
    onMutate: () => {
      trackIntegrationAnalytics('integrations.request_install', {
        integration_type: type,
        integration: slug,
        organization,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Request successfully sent.'));
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage(t('Error sending the request'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {message: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => sendRequestMutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <h4>{t('Request %s Installation', name)}</h4>
        <CloseButton />
      </Header>
      <Body>
        <Flex direction="column" gap="2xl">
          <Text as="p" density="comfortable">
            {t(
              'Looks like your organization owner, manager, or admin needs to install %s. Want to send them a request?',
              name
            )}
          </Text>
          <Text as="p" density="comfortable">
            {t(
              '(Optional) You’ve got good reasons for installing the %s Integration. Share them with your organization owner.',
              name
            )}
          </Text>
          <form.AppField name="message">
            {field => (
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Optional message…')}
              />
            )}
          </form.AppField>
          <Text as="p" density="comfortable">
            {t(
              'When you click “Send Request”, we’ll email your request to your organization’s owners. So just keep that in mind.'
            )}
          </Text>
        </Flex>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Send Request')}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
