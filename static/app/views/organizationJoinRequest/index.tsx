import {useState} from 'react';
import type {MouseEvent} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

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
        <SuccessModal>
          <StyledIconMegaphone size="2xl" />
          <StyledHeader>{t('Request Sent')}</StyledHeader>
          <StyledText>{t('Your request to join has been sent.')}</StyledText>
          <ReceiveEmailMessage>
            {t('You will receive an email when your request is approved.')}
          </ReceiveEmailMessage>
        </SuccessModal>
      </NarrowLayout>
    );
  }

  return (
    <NarrowLayout maxWidth="650px">
      <StyledIconMegaphone size="2xl" />
      <StyledHeader data-test-id="join-request">{t('Request to Join')}</StyledHeader>
      <StyledText>
        {tct('Ask the admins if you can join the [orgId] organization.', {
          orgId,
        })}
      </StyledText>
      <form.AppForm form={form}>
        <FieldWrapper>
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
        </FieldWrapper>
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

const SuccessModal = styled('div')`
  display: grid;
  justify-items: center;
  text-align: center;
  padding-top: 10px;
  padding-bottom: ${p => p.theme.space['3xl']};
`;

const StyledIconMegaphone = styled(IconMegaphone)`
  padding-bottom: ${p => p.theme.space['2xl']};
`;

const StyledHeader = styled('h3')`
  margin-bottom: ${p => p.theme.space.md};
`;

const StyledText = styled('p')`
  margin-bottom: 0;
`;

const ReceiveEmailMessage = styled(StyledText)`
  max-width: 250px;
`;

const FieldWrapper = styled('div')`
  padding-top: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space.xl};
`;
