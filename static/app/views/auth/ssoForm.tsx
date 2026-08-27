import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {t, tct} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';

const schema = z.object({organization: z.string().min(1)});

type SsoLocateRequest = {
  organization: string;
};

type SsoLocateResponse = {
  nextUri: string;
};

type Props = {
  authConfig: AuthConfig;
};

export function SsoForm({authConfig}: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {serverHostname} = authConfig;
  const mutation = useMutation({
    mutationFn: (data: SsoLocateRequest) =>
      fetchMutation<SsoLocateResponse>({
        url: getApiUrl('/auth/sso-locate/'),
        method: 'POST',
        data,
      }),
    onSuccess: response => {
      navigate({pathname: response.nextUri});
    },
    onError: response => {
      const detail =
        response instanceof RequestError ? response.responseJSON?.detail : undefined;
      setError(
        typeof detail === 'string' ? detail : t('Unable to locate the organization.')
      );
    },
  });
  const form = useScrapsForm({
    defaultValues: {organization: ''},
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) => {
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <ScrapsForm form={form}>
      <Stack gap="lg">
        {error && (
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {error}
            </Alert>
          </Alert.Container>
        )}
        <form.Field name="organization">
          {field => (
            <field.Layout.Stack
              label={t('Organization ID')}
              hintText={tct(
                'Your ID is the slug after the hostname. e.g. [example] is [slug].',
                {
                  slug: <strong>acme</strong>,
                  example: <SlugExample slug="acme" hostname={serverHostname} />,
                }
              )}
              required
            >
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder="acme"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <Flex justify="end">
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </Flex>
      </Stack>
    </ScrapsForm>
  );
}

type SlugExampleProps = {
  hostname: string;
  slug: string;
};

function SlugExample({hostname, slug}: SlugExampleProps) {
  return (
    <code>
      {hostname}/<strong>{slug}</strong>
    </code>
  );
}
