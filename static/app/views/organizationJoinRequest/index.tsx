import {useCallback, useState} from 'react';
import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EmailField from 'sentry/components/forms/fields/emailField';
import Form from 'sentry/components/forms/form';
import NarrowLayout from 'sentry/components/narrowLayout';
import {IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

export default function OrganizationJoinRequest() {
  const {orgId} = useParams<{orgId: string}>();
  const location = useLocation();
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmitSuccess = useCallback(() => {
    setSubmitSuccess(true);
    trackAnalytics('join_request.created', {
      organization: orgId,
      referrer: decodeScalar(location.query.referrer, ''),
    });
  }, [orgId, location.query.referrer]);

  const handleSubmitError = useCallback(() => {
    addErrorMessage(t('Request to join failed'));
  }, []);

  const handleCancel = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      testableWindowLocation.assign(`/auth/login/${orgId}/`);
    },
    [orgId]
  );

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
      <Form
        requireChanges
        apiEndpoint={`/organizations/${orgId}/join-request/`}
        apiMethod="POST"
        submitLabel={t('Request to Join')}
        onSubmitSuccess={handleSubmitSuccess}
        onSubmitError={handleSubmitError}
        onCancel={handleCancel}
      >
        <StyledEmailField
          name="email"
          inline={false}
          label={t('Email Address')}
          placeholder="name@example.com"
        />
      </Form>
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

const StyledEmailField = styled(EmailField)`
  padding-top: ${p => p.theme.space.xl};
  padding-left: 0;
`;
