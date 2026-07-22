import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

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
import {useApi} from 'sentry/utils/useApi';

interface WebAuthnParams {
  challenge: string;
  response: string;
  isSuperuserModal?: boolean;
  superuserAccessCategory?: string;
  superuserReason?: string;
}

type AuthPayload = {
  challenge?: string;
  isSuperuserModal?: boolean;
  response?: string;
  superuserAccessCategory?: string;
  superuserReason?: string;
};

type State = {
  errorType: string;
  showAccessForms: boolean;
  superuserAccessCategory: string;
  superuserReason: string;
};

type Props = {
  hasStaff: boolean;
};

function SuperuserStaffAccessForm({hasStaff}: Props) {
  const api = useApi();
  const authUrl = hasStaff ? '/staff-auth/' : '/auth/';
  const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');
  // On staff local dev with U2F disabled we skip the authenticator fetch and
  // submit immediately (see the auto-submit effect below).
  const skipAuthenticators = hasStaff && disableU2FForSUForm;

  const [state, setState] = useState<State>({
    errorType: '',
    showAccessForms: true,
    superuserAccessCategory: '',
    superuserReason: '',
  });

  const {errorType, showAccessForms} = state;
  const error = errorType !== '';

  const {data: authenticators = [], isFetched} = useQuery({
    ...apiOptions.as<Authenticator[]>()('/authenticators/', {staleTime: 0}),
    enabled: !skipAuthenticators,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const autoSubmittedRef = useRef(false);

  const {mutateAsync: authenticate} = useMutation({
    // authUrl is a runtime branch (/auth/ or /staff-auth/), not a known URL
    // literal, so it's passed to fetchMutation as a plain string.
    mutationFn: (data: AuthPayload) => fetchMutation({method: 'PUT', url: authUrl, data}),
  });

  const handleSuccess = useCallback(() => {
    window.location.reload();
  }, []);

  const handleError = useCallback((err: any) => {
    let newErrorType = '';

    if (err.status === 403) {
      if (err.responseJSON.detail.code === 'no_u2f') {
        newErrorType = ErrorCodes.NO_AUTHENTICATOR;
      } else {
        newErrorType = ErrorCodes.INVALID_PASSWORD;
      }
    } else if (err.status === 401) {
      newErrorType = ErrorCodes.INVALID_SSO_SESSION;
    } else if (err.status === 400) {
      if (err.responseJSON.detail.code === 'missing_password_or_u2f') {
        newErrorType = ErrorCodes.MISSING_PASSWORD_OR_U2F;
      } else {
        newErrorType = ErrorCodes.INVALID_ACCESS_CATEGORY;
      }
    } else if (err === ErrorCodes.NO_AUTHENTICATOR) {
      newErrorType = ErrorCodes.NO_AUTHENTICATOR;
    } else {
      newErrorType = ErrorCodes.UNKNOWN_ERROR;
    }

    setState(prevState => ({
      ...prevState,
      errorType: newErrorType,
      showAccessForms: true,
    }));
  }, []);

  const handleLogout = useCallback(() => {
    const {superuserUrl} = window.__initialData.links;
    const urlOrigin =
      window.__initialData.customerDomain && superuserUrl
        ? superuserUrl
        : window.location.origin;

    const nextUrl = new URL('/auth/login/', urlOrigin);
    nextUrl.searchParams.set('next', window.location.href);

    logout(api, nextUrl.toString());
  }, [api]);

  const submitAuth = useCallback(
    async (superuserAccessCategory: string, superuserReason: string) => {
      if (!authenticators.length && !disableU2FForSUForm) {
        handleError(ErrorCodes.NO_AUTHENTICATOR);
        return;
      }

      // First submit reveals the WebAuthn prompt (U2F tap).
      if (state.showAccessForms && !disableU2FForSUForm) {
        setState(prevState => ({
          ...prevState,
          showAccessForms: false,
          superuserAccessCategory,
          superuserReason,
        }));
        return;
      }

      try {
        await authenticate({
          isSuperuserModal: true,
          superuserAccessCategory,
          superuserReason,
        });
        handleSuccess();
      } catch (err) {
        handleError(err);
      }
    },
    [
      authenticators.length,
      disableU2FForSUForm,
      state.showAccessForms,
      authenticate,
      handleError,
      handleSuccess,
    ]
  );

  const handleWebAuthn = useCallback(
    async (data: WebAuthnParams) => {
      const payload: AuthPayload = {...data};
      if (!hasStaff) {
        payload.isSuperuserModal = true;
        payload.superuserAccessCategory = state.superuserAccessCategory;
        payload.superuserReason = state.superuserReason;
      }
      try {
        await authenticate(payload);
        handleSuccess();
      } catch (err) {
        handleError(err);
        // u2fInterface relies on this
        throw err;
      }
    },
    [
      authenticate,
      handleError,
      handleSuccess,
      hasStaff,
      state.superuserAccessCategory,
      state.superuserReason,
    ]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {},
    onSubmit: async ({formApi}) => {
      // TODO(scraps-forms): The superuser access category / reason fields come
      // from the `component:superuser-access-category` getsentry override, which
      // still renders legacy (unbound) form fields, so read their values from
      // the DOM. COPS/CSM populates them via state first. Remove this scrape once
      // that override renders scraps bound fields that flow through `value` (this
      // requires migrating both consumers — this form and sudoModal.tsx).
      const formEl = document.getElementById(formApi.formId);
      const formData = formEl instanceof HTMLFormElement ? new FormData(formEl) : null;
      const domCategory = formData?.get('superuserAccessCategory');
      const domReason = formData?.get('superuserReason');

      const suAccessCategory =
        state.superuserAccessCategory ||
        (typeof domCategory === 'string' ? domCategory : '');
      const suReason =
        state.superuserReason || (typeof domReason === 'string' ? domReason : '');

      await submitAuth(suAccessCategory, suReason);
    },
  });

  // Raise NO_AUTHENTICATOR once the fetch resolves with no authenticators and
  // U2F is required.
  useEffect(() => {
    if (skipAuthenticators || !isFetched) {
      return;
    }
    if (!authenticators.length && !disableU2FForSUForm) {
      handleError(ErrorCodes.NO_AUTHENTICATOR);
    }
    // Only react to the fetch completing; handleError is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetched]);

  // Staff local dev with U2F disabled: submit immediately on mount (once).
  useEffect(() => {
    if (!skipAuthenticators || autoSubmittedRef.current) {
      return;
    }
    autoSubmittedRef.current = true;
    authenticate({superuserAccessCategory: '', superuserReason: ''})
      .then(handleSuccess)
      .catch(handleError);
    // Run exactly once at mount, matching the old componentDidMount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorType === ErrorCodes.INVALID_SSO_SESSION) {
    handleLogout();
    return null;
  }

  const errorAlert = error ? <Alert variant="danger">{errorType}</Alert> : null;

  if (hasStaff) {
    // On the auto-submit path show the spinner until it fails (success reloads).
    const isLoading = skipAuthenticators ? !error : !isFetched;
    if (isLoading) {
      return <LoadingIndicator />;
    }
    return (
      <Fragment>
        {errorAlert}
        <WebAuthn
          mode="sudo"
          authenticators={authenticators}
          onWebAuthn={handleWebAuthn}
        />
      </Fragment>
    );
  }

  return (
    <form.AppForm form={form}>
      {errorAlert}
      {showAccessForms ? (
        <Override name="component:superuser-access-category" />
      ) : (
        <WebAuthn
          mode="sudo"
          authenticators={authenticators}
          onWebAuthn={handleWebAuthn}
        />
      )}
      <Flex justify="between" align="center" gap="md" margin="xl 0 0">
        <Flex align="center" margin="0 3xl">
          {/* COPS/CSM shortcut: skip the access-category/reason step with canned values. */}
          <Button onClick={() => submitAuth('cops_csm', 'COPS and CSM use')}>
            {t('COPS/CSM')}
          </Button>
        </Flex>
        <form.SubmitButton>{t('Continue')}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

export default SuperuserStaffAccessForm;
