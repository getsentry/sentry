import {useCallback, useEffect, useRef, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {logout} from 'sentry/actionCreators/account';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Override} from 'sentry/components/override';
import {WebAuthn} from 'sentry/components/webAuthn';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Authenticator} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';

type AuthPayload = {
  challenge?: string;
  isSuperuserModal?: boolean;
  response?: string;
  superuserAccessCategory?: string;
  superuserReason?: string;
};

type Props = {
  hasStaff: boolean;
};

type AccessDetails = {
  superuserAccessCategory: string;
  superuserReason: string;
};

type FormState =
  | {step: 'access'; errorType?: ErrorCodes}
  | {access: AccessDetails; step: 'webauthn'};

const accessSchema = z.object({
  superuserAccessCategory: z.string().min(1, t('Select an access category')),
  superuserReason: z
    .string()
    .trim()
    .min(4, t('Enter a reason of at least 4 characters'))
    .max(128, t('Reason must be 128 characters or fewer')),
});

function getErrorType(err: RequestError): ErrorCodes {
  const detail = err.responseJSON?.detail;
  const code = detail !== null && typeof detail === 'object' ? detail.code : undefined;

  switch (err.status) {
    case 403:
      return code === 'no_u2f'
        ? ErrorCodes.NO_AUTHENTICATOR
        : ErrorCodes.INVALID_PASSWORD;
    case 401:
      return ErrorCodes.INVALID_SSO_SESSION;
    case 400:
      return code === 'missing_password_or_u2f'
        ? ErrorCodes.MISSING_PASSWORD_OR_U2F
        : ErrorCodes.INVALID_ACCESS_CATEGORY;
    default:
      return ErrorCodes.UNKNOWN_ERROR;
  }
}

function reloadPage() {
  testableWindowLocation.reload();
}

function SuperuserStaffAccessForm({hasStaff}: Props) {
  const api = useApi();
  const authUrl = hasStaff ? '/staff-auth/' : '/auth/';
  const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');
  const shouldAutoSubmit = hasStaff && disableU2FForSUForm;

  const [state, setState] = useState<FormState>({step: 'access'});

  const {data: authenticators = [], isFetchedAfterMount: authenticatorsLoaded} = useQuery(
    {
      ...apiOptions.as<Authenticator[]>()('/authenticators/', {staleTime: 0}),
      enabled: !disableU2FForSUForm,
      retry: false,
      refetchOnWindowFocus: true,
    }
  );

  const autoSubmittedRef = useRef(false);

  const {mutateAsync: authenticate} = useMutation({
    // authUrl is a runtime branch (/auth/ or /staff-auth/), not a known URL
    // literal, so it's passed to fetchMutation as a plain string.
    mutationFn: (data: AuthPayload) => fetchMutation({method: 'PUT', url: authUrl, data}),
  });

  const handleError = useCallback((err: unknown) => {
    setState({
      step: 'access',
      errorType:
        err instanceof RequestError ? getErrorType(err) : ErrorCodes.UNKNOWN_ERROR,
    });
  }, []);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      superuserAccessCategory: '',
      superuserReason: '',
    },
    validators: {onDynamic: accessSchema},
    onSubmit: async ({value}) => {
      const access = accessSchema.parse(value);

      if (!disableU2FForSUForm) {
        if (!authenticators.length) {
          setState({step: 'access', errorType: ErrorCodes.NO_AUTHENTICATOR});
          return;
        }

        setState({step: 'webauthn', access});
        return;
      }

      try {
        await authenticate({isSuperuserModal: true, ...access});
        reloadPage();
      } catch (err) {
        form.reset();
        handleError(err);
      }
    },
  });

  const webAuthnAccess = state.step === 'webauthn' ? state.access : undefined;

  const handleWebAuthn = useCallback(
    async (data: {challenge: string; response: string}) => {
      const payload: AuthPayload = {...data};
      if (!hasStaff) {
        if (!webAuthnAccess) {
          return;
        }
        payload.isSuperuserModal = true;
        payload.superuserAccessCategory = webAuthnAccess.superuserAccessCategory;
        payload.superuserReason = webAuthnAccess.superuserReason;
      }
      try {
        await authenticate(payload);
        reloadPage();
      } catch (err) {
        form.reset();
        handleError(err);
        // u2fInterface relies on this
        throw err;
      }
    },
    [authenticate, form, handleError, hasStaff, webAuthnAccess]
  );

  // Staff local dev with U2F disabled: submit immediately on mount (once).
  useEffect(() => {
    if (!shouldAutoSubmit || autoSubmittedRef.current) {
      return;
    }
    autoSubmittedRef.current = true;
    authenticate({superuserAccessCategory: '', superuserReason: ''})
      .then(reloadPage)
      .catch(handleError);
  }, [authenticate, handleError, shouldAutoSubmit]);

  const requiresAuthenticator = !disableU2FForSUForm;
  const noAuthenticator =
    requiresAuthenticator && authenticatorsLoaded && !authenticators.length;
  const authenticatorsReady =
    !requiresAuthenticator || (authenticatorsLoaded && authenticators.length > 0);
  const stateErrorType = state.step === 'access' ? state.errorType : undefined;
  const errorType =
    stateErrorType ?? (noAuthenticator ? ErrorCodes.NO_AUTHENTICATOR : undefined);

  // An expired SSO session is terminal: redirect to re-auth.
  const ssoExpired = errorType === ErrorCodes.INVALID_SSO_SESSION;
  useEffect(() => {
    if (!ssoExpired) {
      return;
    }

    const {superuserUrl} = window.__initialData.links;
    const urlOrigin =
      window.__initialData.customerDomain && superuserUrl
        ? superuserUrl
        : window.location.origin;
    const nextUrl = new URL('/auth/login/', urlOrigin);
    nextUrl.searchParams.set('next', window.location.href);

    logout(api, nextUrl.toString());
  }, [api, ssoExpired]);

  if (ssoExpired) {
    return null;
  }

  const errorAlert = errorType ? <Alert variant="danger">{errorType}</Alert> : null;

  if (hasStaff) {
    // On the auto-submit path show the spinner until it fails (success reloads).
    const isLoading = shouldAutoSubmit ? !errorType : !authenticatorsLoaded;
    if (isLoading) {
      return <LoadingIndicator />;
    }
    return (
      <Stack gap="xl">
        {errorAlert}
        <WebAuthn
          mode="sudo"
          authenticators={authenticators}
          onWebAuthn={handleWebAuthn}
        />
      </Stack>
    );
  }

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        {errorAlert}
        {state.step === 'access' ? (
          <form.AppField name="superuserAccessCategory">
            {accessCategoryField => (
              <form.AppField name="superuserReason">
                {reasonField => (
                  // TODO(scraps-forms): This override is shared with sudoModal, which
                  // still uses the legacy FormModel. Keep Scraps as the source of truth
                  // and bridge values and errors until both consumers migrate together.
                  <Override
                    name="component:superuser-access-category"
                    accessCategory={accessCategoryField.state.value}
                    accessCategoryError={
                      accessCategoryField.state.meta.errors[0]?.message
                    }
                    reason={reasonField.state.value}
                    reasonError={reasonField.state.meta.errors[0]?.message}
                    onAccessCategoryChange={accessCategoryField.handleChange}
                    onReasonChange={reasonField.handleChange}
                  />
                )}
              </form.AppField>
            )}
          </form.AppField>
        ) : (
          <WebAuthn
            mode="sudo"
            authenticators={authenticators}
            onWebAuthn={handleWebAuthn}
          />
        )}
      </Stack>
      {state.step === 'access' ? (
        <Flex justify="between" align="center" gap="md" margin="xl 0 0">
          <Button
            disabled={!authenticatorsReady}
            onClick={() => {
              form.setFieldValue('superuserAccessCategory', 'cops_csm');
              form.setFieldValue('superuserReason', 'COPS and CSM use');
              form.handleSubmit();
            }}
          >
            {t('COPS/CSM')}
          </Button>
          <form.SubmitButton disabled={!authenticatorsReady}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      ) : (
        <Flex justify="end" margin="xl 0 0">
          <Button
            variant="transparent"
            onClick={() => {
              form.reset();
              setState({step: 'access'});
            }}
          >
            {t('Change reason')}
          </Button>
        </Flex>
      )}
    </form.AppForm>
  );
}

export default SuperuserStaffAccessForm;
