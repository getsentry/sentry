import {Fragment, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openRecoveryOptions} from 'sentry/actionCreators/modal';
import {
  fetchOrganizationByMember,
  fetchOrganizations,
} from 'sentry/actionCreators/organizations';
import CircleIndicator from 'sentry/components/circleIndicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import type {FieldObject} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextCopyInput from 'sentry/components/textCopyInput';
import U2fSign from 'sentry/components/u2f/u2fsign';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import {generateOrgSlugUrl} from 'sentry/utils';
import getPendingInvite from 'sentry/utils/getPendingInvite';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type GetFieldsOpts = {
  authenticator: Authenticator;
  /**
   * Flag to track if totp has been sent
   */
  hasSentCode: boolean;
  /**
   * Callback to reset SMS 2fa enrollment
   */
  onSmsReset: () => void;
  /**
   * Callback when u2f device is activated
   */
  onU2fTap: React.ComponentProps<typeof U2fSign>['onTap'];
  /**
   * Flag to track if we are currently sending the otp code
   */
  sendingCode: boolean;
};

/**
 * Retrieve additional form fields (or modify ones) based on 2fa method
 */
const getFields = ({
  authenticator,
  hasSentCode,
  sendingCode,
  onSmsReset,
  onU2fTap,
}: GetFieldsOpts): null | FieldObject[] => {
  const {form} = authenticator;

  if (!form) {
    return null;
  }

  if (authenticator.id === 'totp') {
    return [
      () => (
        <CodeContainer key="qrcode">
          <StyledQRCode
            aria-label={t('Enrollment QR Code')}
            value={authenticator.qrcode}
            size={228}
          />
        </CodeContainer>
      ),
      () => (
        <FieldGroup key="secret" label={t('Authenticator secret')}>
          <TextCopyInput>{authenticator.secret ?? ''}</TextCopyInput>
        </FieldGroup>
      ),
      ...form,
      () => (
        <Actions key="confirm">
          <Button priority="primary" type="submit">
            {t('Confirm')}
          </Button>
        </Actions>
      ),
    ];
  }

  // Sms Form needs a start over button + confirm button
  // Also inputs being disabled vary based on hasSentCode
  if (authenticator.id === 'sms') {
    // Ideally we would have greater flexibility when rendering footer
    return [
      {...form[0]!, disabled: sendingCode || hasSentCode},
      ...(hasSentCode ? [{...form[1]!, required: true}] : []),
      () => (
        <Actions key="sms-footer">
          <ButtonBar gap={1}>
            {hasSentCode && <Button onClick={onSmsReset}>{t('Start Over')}</Button>}
            <Button priority="primary" type="submit">
              {hasSentCode ? t('Confirm') : t('Send Code')}
            </Button>
          </ButtonBar>
        </Actions>
      ),
    ];
  }

  // Need to render device name field + U2f component
  if (authenticator.id === 'u2f') {
    const deviceNameField = form.find(({name}) => name === 'deviceName')!;
    return [
      deviceNameField,
      () => (
        <U2fSign
          key="u2f-enroll"
          style={{marginBottom: 0}}
          challengeData={authenticator.challenge}
          displayMode="enroll"
          onTap={onU2fTap}
        />
      ),
    ];
  }

  return null;
};

type PendingInvite = ReturnType<typeof getPendingInvite>;

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
function AccountSecurityEnroll() {
  const api = useApi();
  const formModel = new FormModel();
  const params = useParams<{authId: string}>();
  const navigate = useNavigate();

  const [hasSentCode, setHasSentCode] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const pendingInvitation: PendingInvite = getPendingInvite();

  const authenticatorEndpoint = `/users/me/authenticators/${params.authId}/`;
  const enrollEndpoint = `${authenticatorEndpoint}enroll/`;

  const {
    data: authenticator,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Authenticator>([enrollEndpoint], {
    staleTime: 0,
    retry: (_failureCount, error) => {
      const alreadyEnrolled =
        error?.status === 400 && error?.responseJSON?.details === 'Already enrolled';

      if (alreadyEnrolled) {
        navigate('/settings/account/security/');
        addErrorMessage(t('Already enrolled'));

        // Allow the endpoint to fail if the user is already enrolled
        return false;
      }

      // Otherwise retry
      return alreadyEnrolled;
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(authenticatorEndpoint, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      navigate('/settings/account/security/');
      addSuccessMessage(t('Authenticator has been removed'));
    },
    onError: () => {
      addErrorMessage(t('Error removing authenticator'));
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const authenticatorName = authenticator?.name ?? 'Authenticator';

  // Handler when we successfully add a 2fa device
  const handleEnrollSuccess = async () => {
    // If we're pending approval of an invite, the user will have just joined
    // the organization when completing 2fa enrollment. We should reload the
    // organization context in that case to assign them to the org.
    if (pendingInvitation) {
      await fetchOrganizationByMember(api, pendingInvitation.memberId.toString(), {
        addOrg: true,
        fetchOrgDetails: true,
      });
    }

    navigate('/settings/account/security/');
    openRecoveryOptions({authenticatorName});

    // The remainder of this function is included primarily to smooth out the relocation flow. The
    // newly claimed user will have landed on `https://sentry.io/settings/account/security` to
    // perform the 2FA registration. But now that they have in fact registered, we want to redirect
    // them to the subdomain of the organization they are already a member of (ex:
    // `https://my-2fa-org.sentry.io`), but did not have the ability to access due to their previous
    // lack of 2FA enrollment.
    let orgs = OrganizationsStore.getAll();
    if (orgs.length === 0) {
      // Try to load orgs post 2FA again.
      orgs = await fetchOrganizations(api, {member: '1'});
      OrganizationsStore.load(orgs);

      // Still no orgs? Nowhere to redirect the user to, so just stay in place.
      if (orgs.length === 0) {
        return;
      }
    }

    // If we are already in an org sub-domain, we don't need to do any redirection. If we are not
    // (this is usually only the case for a newly claimed relocated user), we redirect to the org
    // slug's subdomain now.
    const isAlreadyInOrgSubDomain = orgs.some(org => {
      return org.links.organizationUrl === new URL(window.location.href).origin;
    });
    if (!isAlreadyInOrgSubDomain) {
      window.location.assign(generateOrgSlugUrl(orgs[0]!.slug));
    }
  };

  // Handler when we failed to add a 2fa device
  const handleEnrollError = () => {
    addErrorMessage(t('Error adding %s authenticator', authenticatorName));
  };

  // This resets state so that user can re-enter their phone number again
  const handleSmsReset = () => {
    setHasSentCode(false);
    refetch();
  };

  // Handles SMS authenticators
  const handleSmsSubmit = async (dataModel: any) => {
    const {phone, otp} = dataModel;

    // Don't submit if empty
    if (!phone || !authenticator) {
      return;
    }

    const data = {
      phone,
      // Make sure `otp` is undefined if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? otp : undefined,
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    setSendingCode(!hasSentCode);

    if (hasSentCode) {
      addLoadingMessage(t('Verifying OTP...'));
    } else {
      addLoadingMessage(t('Sending code to %s...', data.phone));
    }

    try {
      await api.requestPromise(enrollEndpoint, {data});
    } catch (error) {
      formModel.resetForm();

      addErrorMessage(hasSentCode ? t('Incorrect OTP') : t('Error sending SMS'));

      setHasSentCode(false);
      setSendingCode(false);

      // Re-fetch because we want to fetch a fresh secret
      refetch();
      return;
    }

    if (hasSentCode) {
      // OTP was accepted and SMS was added as a 2fa method
      handleEnrollSuccess();
    } else {
      // Just successfully finished sending OTP to user
      setHasSentCode(true);
      setSendingCode(false);
      addSuccessMessage(t('Sent code to %s', data.phone));
    }
  };

  // Handle u2f device tap
  const handleU2fTap = async (tapData: any) => {
    const data = {deviceName: formModel.getValue('deviceName'), ...tapData};

    try {
      await api.requestPromise(enrollEndpoint, {data});
    } catch (err) {
      handleEnrollError();
      return;
    }

    handleEnrollSuccess();
  };

  // Currently only TOTP uses this
  const handleTotpSubmit = async (dataModel: any) => {
    if (!authenticator) {
      return;
    }

    const data = {
      ...dataModel,
      secret: authenticator.secret,
    };

    try {
      await api.requestPromise(enrollEndpoint, {method: 'POST', data});
    } catch (err) {
      handleEnrollError();
      return;
    }

    handleEnrollSuccess();
  };

  const handleSubmit: FormProps['onSubmit'] = data => {
    const id = authenticator?.id;

    if (id === 'totp') {
      handleTotpSubmit(data);
      return;
    }
    if (id === 'sms') {
      handleSmsSubmit(data);
      return;
    }
  };

  // Removes an authenticator
  const handleRemove = () => {
    if (!authenticator?.authId) {
      return;
    }

    // `authenticator.authId` is NOT the same as `props.params.authId` This is
    // for backwards compatibility with API endpoint
    removeMutation.mutate();
  };

  if (!authenticator) {
    return null;
  }

  const fields = getFields({
    authenticator,
    hasSentCode,
    sendingCode,
    onSmsReset: handleSmsReset,
    onU2fTap: handleU2fTap,
  });

  // Attempt to extract `defaultValue` from server generated form fields
  const defaultValues = fields
    ? fields
        .filter(
          field =>
            typeof field !== 'function' && typeof field.defaultValue !== 'undefined'
        )
        .map(field => [field.name, typeof field === 'function' ? '' : field.defaultValue])
        .reduce(
          (acc, [name, value]) => {
            acc[name] = value;
            return acc;
          },
          {} as Record<string, any>
        )
    : {};

  const isActive = authenticator.isEnrolled || authenticator.status === 'rotation';

  return (
    <SentryDocumentTitle title={t('Security')}>
      <SettingsPageHeader
        title={
          <Fragment>
            <span>{authenticator.name}</span>
            <CircleIndicator
              role="status"
              aria-label={
                isActive
                  ? t('Authentication Method Active')
                  : t('Authentication Method Inactive')
              }
              enabled={isActive}
              css={css`
                margin-left: 6px;
              `}
            />
          </Fragment>
        }
        action={
          authenticator.isEnrolled &&
          authenticator.removeButton && (
            <RemoveConfirm onConfirm={handleRemove}>
              <Button priority="danger">{authenticator.removeButton}</Button>
            </RemoveConfirm>
          )
        }
      />

      <TextBlock>{authenticator.description}</TextBlock>

      {authenticator.rotationWarning && authenticator.status === 'rotation' && (
        <Alert.Container>
          <Alert type="warning" showIcon>
            {authenticator.rotationWarning}
          </Alert>
        </Alert.Container>
      )}

      {!!authenticator.form?.length && (
        <Form
          model={formModel}
          apiMethod="POST"
          apiEndpoint={authenticatorEndpoint}
          onSubmit={handleSubmit}
          initialData={{...defaultValues, ...authenticator}}
          hideFooter
        >
          <JsonForm forms={[{title: 'Configuration', fields: fields ?? []}]} />
        </Form>
      )}
    </SentryDocumentTitle>
  );
}

const CodeContainer = styled(PanelItem)`
  justify-content: center;
`;

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

const StyledQRCode = styled(QRCodeCanvas)`
  background: white;
  padding: ${space(2)};
`;

export default AccountSecurityEnroll;
