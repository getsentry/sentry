import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {NarrowLayout} from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

const consentChoiceSchema = z.enum(['true', 'false']);
const schema = z.object({
  subscribed: consentChoiceSchema
    .or(z.literal(''))
    .refine(value => value !== '', t('Please select an option')),
});
const defaultValues: z.input<typeof schema> = {subscribed: ''};

type Props = {
  onSubmitSuccess?: () => void;
};

function NewsletterConsent({onSubmitSuccess}: Props) {
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation({
        url: getApiUrl('/users/$userId/subscriptions/', {path: {userId: 'me'}}),
        method: 'POST',
        data,
      }),
    onSuccess: onSubmitSuccess,
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value}) => {
      try {
        await mutation.mutateAsync(schema.parse(value));
      } catch {
        // mutateAsync rejects even though the mutation exposes the error state.
        // Swallow it here so it does not escape the form submit handler.
      }
    },
  });

  useEffect(() => {
    document.body.classList.add('auth');

    return () => document.body.classList.remove('auth');
  }, []);

  // NOTE: the text here is duplicated within ``RegisterForm`` on the backend
  return (
    <NarrowLayout>
      <Stack gap="xl">
        <Text as="p">
          {t('Pardon the interruption, we just need to get a quick answer from you.')}
        </Text>
        <form.AppForm form={form}>
          <Stack gap="xl">
            <form.AppField name="subscribed">
              {field => (
                <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
                  {({Item}) => (
                    <field.Layout.Stack
                      label={t('Email Updates')}
                      hintText={tct(
                        `We'd love to keep you updated via email with product and feature
                    announcements, promotions, educational materials, and events. Our updates
                    focus on relevant information, and we'll never sell your data to third
                    parties. See our [link:Privacy Policy] for more details.`,
                        {link: <ExternalLink href="https://sentry.io/privacy/" />}
                      )}
                      required
                    >
                      <Stack gap="sm">
                        <Item value="true">
                          {t('Yes, I would like to receive updates via email')}
                        </Item>
                        <Item value="false">
                          {t("No, I'd prefer not to receive these updates")}
                        </Item>
                      </Stack>
                    </field.Layout.Stack>
                  )}
                </field.RadioGroup>
              )}
            </form.AppField>
            <Flex justify="end" borderTop="secondary" paddingTop="xl" paddingBottom="xl">
              <form.SubmitButton>{t('Continue')}</form.SubmitButton>
            </Flex>
          </Stack>
        </form.AppForm>
      </Stack>
    </NarrowLayout>
  );
}

export default NewsletterConsent;
