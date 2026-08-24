import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {NarrowLayout} from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';

const consentChoiceSchema = z.enum(['true', 'false']);
const schema = z.object({
  beacon: z.object({record_cpu_ram_usage: consentChoiceSchema}),
});
const defaultValues: z.infer<typeof schema> = {
  beacon: {record_cpu_ram_usage: 'true'},
};

type Props = {
  onSubmitSuccess?: () => void;
};

function BeaconConsent({onSubmitSuccess}: Props) {
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation({
        url: '/internal/options/',
        method: 'PUT',
        data: {'beacon.record_cpu_ram_usage': data.beacon.record_cpu_ram_usage},
      }),
    onSuccess: onSubmitSuccess,
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value}) => {
      try {
        await mutation.mutateAsync(value);
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

  return (
    <NarrowLayout>
      <Stack gap="xl">
        <Text as="p">
          {t(
            'We have made some updates to our self-hosted beacon broadcast system, and just need to get a quick answer from you.'
          )}
        </Text>
        <Stack.Separator />
        <form.AppForm form={form}>
          <Stack gap="xl">
            <form.AppField name="beacon.record_cpu_ram_usage">
              {field => (
                <field.Radio.Group
                  value={field.state.value}
                  onChange={value => field.handleChange(consentChoiceSchema.parse(value))}
                >
                  <field.Layout.Stack
                    label={t('CPU/RAM Usage')}
                    hintText={tct(
                      `Recording CPU/RAM usage will greatly help our development team understand how self-hosted sentry
                  is typically being used, and to keep track of improvements that we hope to bring you in the future.`,
                      {link: <ExternalLink href="https://sentry.io/privacy/" />}
                    )}
                    required
                  >
                    <Stack gap="sm">
                      <field.Radio.Item value="true">
                        {t(
                          'Yes, I would love to help Sentry developers improve the experience of self-hosted by sending CPU/RAM usage'
                        )}
                      </field.Radio.Item>
                      <field.Radio.Item value="false">
                        {t("No, I'd prefer to keep CPU/RAM usage private")}
                      </field.Radio.Item>
                    </Stack>
                  </field.Layout.Stack>
                </field.Radio.Group>
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

export default BeaconConsent;
