import {useState} from 'react';
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
  email: z.string().email(t('Please enter a valid email address')),
});

export default function OrganizationJoinRequest() {
  const {orgId} = useParams<{orgId: string}>();
  const location = useLocation();
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: {email: string}) =>
      fetchMutation({
        url: `/organizations/${orgId}/join-request/`,
        method: 'POST',
        data,
      }),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: ''},
    validators: {onDynamic: joinRequestSchema},
    onSubmit: async ({value}) => {
      try {
        await mutation.mutateAsync(value);
      } catch {
        addErrorMessage(t('Request to join failed'));
        return;
      }

      setSubmitSuccess(true);
      trackAnalytics('join_request.created', {
        organization: orgId,
        referrer: decodeScalar(location.query.referrer, ''),
      });
    },
  });

  const handleCancel = (e: MouseEvent) => {
    e.preventDefault();
    testableWindowLocation.assign(`/auth/login/${orgId}/`);
  };

  if (submitSuccess) {
    return (
      <NarrowLayout maxWidth="550px">
        <Stack align="center" paddingTop="lg" paddingBottom="3xl">
          <Container paddingBottom="2xl">
            <IconMegaphone size="2xl" />
          </Container>
          <Container paddingBottom="md">
            <Heading as="h3">{t('Request Sent')}</Heading>
          </Container>
          <Text as="p" align="center">
            {t('Your request to join has been sent.')}
          </Text>
          <Container maxWidth="250px">
            <Text as="p" align="center">
              {t('You will receive an email when your request is approved.')}
            </Text>
          </Container>
        </Stack>
      </NarrowLayout>
    );
  }

  return (
    <NarrowLayout maxWidth="650px">
      <Container paddingBottom="2xl">
        <IconMegaphone size="2xl" />
      </Container>
      <Container paddingBottom="md">
        <Heading as="h3" data-test-id="join-request">
          {t('Request to Join')}
        </Heading>
      </Container>
      <Text as="p">
        {tct('Ask the admins if you can join the [orgId] organization.', {
          orgId,
        })}
      </Text>
      <form.AppForm form={form}>
        <Container paddingTop="xl" paddingBottom="xl">
          <form.AppField name="email">
            {field => (
              <field.Layout.Stack label={t('Email Address')}>
                <field.Input
                  type="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="name@example.com"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Container>
        <form.Subscribe selector={state => state.isDirty}>
          {isDirty => (
            <Flex gap="md" justify="end">
              <Button onClick={handleCancel}>{t('Cancel')}</Button>
              <form.SubmitButton disabled={!isDirty}>
                {t('Request to Join')}
              </form.SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </form.AppForm>
    </NarrowLayout>
  );
}
