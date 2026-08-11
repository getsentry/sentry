import type {MouseEvent} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

const joinRequestSchema = z.object({
  email: z.email(t('Please enter a valid email address')),
});

export default function OrganizationJoinRequest() {
  const {orgId} = useParams<{orgId: string}>();
  const location = useLocation();

  const mutation = useMutation({
    mutationFn: (data: {email: string}) =>
      fetchMutation({
        url: `/organizations/${orgId}/join-request/`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      trackAnalytics('join_request.created', {
        organization: orgId,
        referrer: decodeScalar(location.query.referrer, ''),
      });
    },
    onError: () => {
      addErrorMessage(t('Request to join failed'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: ''},
    validators: {onDynamic: joinRequestSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  const handleCancel = (e: MouseEvent) => {
    e.preventDefault();
    testableWindowLocation.assign(`/auth/login/${orgId}/`);
  };

  if (mutation.isSuccess) {
    return (
      <NarrowLayout maxWidth="550px">
        <Stack align="center" gap="xl" paddingTop="lg" paddingBottom="3xl">
          <IconMegaphone size="xl" />
          <Stack align="center" gap="md">
            <Heading as="h3" size="xl">
              {t('Request Sent')}
            </Heading>
            <Text as="p" align="center">
              {t('Your request to join has been sent.')}
            </Text>
            <Container maxWidth="250px">
              <Text as="p" align="center">
                {t('You will receive an email when your request is approved.')}
              </Text>
            </Container>
          </Stack>
        </Stack>
      </NarrowLayout>
    );
  }

  return (
    <NarrowLayout maxWidth="650px">
      <Stack gap="xl">
        <IconMegaphone size="xl" />
        <Stack gap="md">
          <Heading as="h3" size="xl" data-test-id="join-request">
            {t('Request to Join')}
          </Heading>
          <Text as="p">
            {tct('Ask the admins if you can join the [orgId] organization.', {
              orgId,
            })}
          </Text>
        </Stack>
        <form.AppForm form={form}>
          <Stack gap="xl">
            <form.AppField name="email">
              {field => (
                <field.Layout.Stack label={t('Email Address')} required>
                  <field.Input
                    type="email"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="name@example.com"
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <Container borderTop="secondary" paddingTop="xl" paddingBottom="xl">
              <Flex gap="md" justify="end">
                <Button onClick={handleCancel}>{t('Cancel')}</Button>
                <form.SubmitButton>{t('Request to Join')}</form.SubmitButton>
              </Flex>
            </Container>
          </Stack>
        </form.AppForm>
      </Stack>
    </NarrowLayout>
  );
}
