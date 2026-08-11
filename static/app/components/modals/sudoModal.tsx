import {Fragment, useCallback, useEffect, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import trimEnd from 'lodash/trimEnd';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  getBoostrapTeamsQueryOptions,
  getBootstrapOrganizationQueryOptions,
  getBootstrapProjectsQueryOptions,
} from 'sentry/bootstrap/bootstrapRequests';
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
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';

type AuthPayload = {
  challenge?: string;
  isSuperuserModal?: boolean;
  password?: string;
  response?: string;
  superuserAccessCategory?: string;
  superuserReason?: string;
};

type AccessDetails = {
  superuserAccessCategory: string;
  superuserReason: string;
};

type SuperuserStep = {step: 'access'} | {access: AccessDetails; step: 'webauthn'};

type DefaultProps = {
  closeButton?: boolean;
};

type Props = DefaultProps &
  Pick<ModalRenderProps, 'Body' | 'Footer' | 'Header'> & {
    closeModal: () => void;
    /**
     * User is a superuser without an active su session
     */
    isSuperuser?: boolean;
    needsReload?: boolean;
    /**
     * expects a function that returns a Promise
     */
    retryRequest?: () => Promise<any>;
  };

const passwordSchema = z.object({
  password: z.string(),
});

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
      return ErrorCodes.INVALID_ACCESS_CATEGORY;
    default:
      return ErrorCodes.UNKNOWN_ERROR;
  }
}

function SudoModal({
  closeModal,
  isSuperuser,
  needsReload,
  retryRequest,
  Header,
  Body,
  Footer,
  closeButton,
}: Props) {
  const user = useUser();
  const navigate = useNavigate();
  const params = useParams<{orgId?: string}>();
  const location = useLocation();
  const api = useApi();

  const [errorType, setErrorType] = useState<ErrorCodes>();
  const [superuserStep, setSuperuserStep] = useState<SuperuserStep>({
    step: 'access',
  });

  const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');

  const orgSlug = params.orgId ?? null;
  // We have to wait for these requests to finish before we can sudo, otherwise
  // we'll overwrite the session cookie with a stale one.
  // Not sharing the bootstrap hooks to avoid mutating the store.
  const {isFetching: isOrganizationFetching} = useQuery(
    getBootstrapOrganizationQueryOptions(orgSlug)
  );
  const {isFetching: isTeamsFetching} = useQuery(getBoostrapTeamsQueryOptions(orgSlug));
  const {isFetching: isProjectsFetching} = useQuery(
    getBootstrapProjectsQueryOptions(orgSlug)
  );
  const bootstrapIsPending =
    isOrganizationFetching || isTeamsFetching || isProjectsFetching;

  // XXX(epurkhiser): Using isFetchedAfterMount here since the WebAuthn
  // authenticator will always produce a new challenge. We don't want to render
  // the WebAuthnAssert and then re-render with a different challenge, causing
  // the prompt to trigger twice.
  const {
    data: authenticators = [],
    isFetching: authenticatorsFetching,
    isFetchedAfterMount: authenticatorsLoaded,
  } = useQuery({
    ...apiOptions.as<Authenticator[]>()('/authenticators/', {staleTime: 0}),
    // Fetch authenticators after preload requests to avoid overwriting session cookie
    enabled: !bootstrapIsPending,
    retry: false,
    // Immeditealy refetch authenticators on window / tab focus. If a user had
    // multiple tabs open and required authentication in any other tabs we may
    // have stomped the session state the request sets, and will need to reload
    // session state immediately.
    refetchOnWindowFocus: true,
  });

  const handleSuccess = useCallback(() => {
    if (isSuperuser) {
      navigate(
        {pathname: location.pathname, state: {forceUpdate: new Date()}},
        {replace: true}
      );
      if (needsReload) {
        testableWindowLocation.reload();
      }
      return;
    }

    if (!retryRequest) {
      closeModal();
      return;
    }

    retryRequest().then(closeModal);
  }, [closeModal, isSuperuser, location.pathname, navigate, needsReload, retryRequest]);

  const handleError = useCallback((err: unknown) => {
    setErrorType(
      err instanceof RequestError ? getErrorType(err) : ErrorCodes.UNKNOWN_ERROR
    );
    // Return a superuser flow to the access step so the error is visible.
    setSuperuserStep(currentStep =>
      currentStep.step === 'access' ? currentStep : {step: 'access'}
    );
  }, []);

  const {mutateAsync: authenticate} = useMutation({
    mutationFn: (data: AuthPayload) =>
      fetchMutation({method: 'PUT', url: '/auth/', data}),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const passwordForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {password: ''},
    validators: {onDynamic: passwordSchema},
    onSubmit: async ({value}) => {
      try {
        await authenticate({
          isSuperuserModal: isSuperuser,
          ...(user.hasPasswordAuth ? {password: value.password} : {}),
        });
      } catch {
        passwordForm.reset();
      }
    },
  });

  const superuserForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      superuserAccessCategory: '',
      superuserReason: '',
    },
    validators: {onDynamic: accessSchema},
    onSubmit: async ({value}) => {
      const access = accessSchema.parse(value);

      if (!disableU2FForSUForm) {
        // Without an authenticator the webauthn step has nothing to render.
        if (!authenticators.length) {
          setErrorType(ErrorCodes.NO_AUTHENTICATOR);
          return;
        }

        setErrorType(undefined);
        setSuperuserStep({step: 'webauthn', access});
        return;
      }

      try {
        await authenticate({isSuperuserModal: true, ...access});
      } catch {
        superuserForm.reset();
      }
    },
  });

  const webAuthnAccess =
    superuserStep.step === 'webauthn' ? superuserStep.access : undefined;

  const handleWebAuthn = useCallback(
    async (data: {challenge: string; response: string}) => {
      const payload: AuthPayload = {...data, isSuperuserModal: isSuperuser};
      if (webAuthnAccess) {
        payload.superuserAccessCategory = webAuthnAccess.superuserAccessCategory;
        payload.superuserReason = webAuthnAccess.superuserReason;
      }
      // It's ok to throw from here, u2fInterface will handle it.
      await authenticate(payload);
    },
    [authenticate, isSuperuser, webAuthnAccess]
  );

  const getAuthLoginPath = (): string => {
    const authLoginPath = `/auth/login/?next=${encodeURIComponent(window.location.href)}`;
    const {superuserUrl} = window.__initialData.links;
    if (window.__initialData?.customerDomain && superuserUrl) {
      return `${trimEnd(superuserUrl, '/')}${authLoginPath}`;
    }
    return authLoginPath;
  };

  // Resolved at render time so it reports even when validation blocks submission.
  const noAuthenticator =
    isSuperuser && !disableU2FForSUForm && authenticatorsLoaded && !authenticators.length;
  const resolvedErrorType =
    errorType ?? (noAuthenticator ? ErrorCodes.NO_AUTHENTICATOR : undefined);

  // An expired SSO session is terminal: redirect to re-auth.
  const ssoExpired = resolvedErrorType === ErrorCodes.INVALID_SSO_SESSION;
  useEffect(() => {
    if (ssoExpired) {
      logout(api, getAuthLoginPath());
    }
  }, [api, ssoExpired]);

  const renderModalContent = () => {
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    const validateSUForm = ConfigStore.get('validateSUForm');
    const header = (
      <Header closeButton={closeButton}>
        <Heading as="h4">{t('Confirm Password to Continue')}</Heading>
      </Header>
    );

    if (ssoExpired) {
      return (
        <Fragment>
          {header}
          <Body />
        </Fragment>
      );
    }

    if (authenticatorsFetching || !authenticatorsLoaded || bootstrapIsPending) {
      return (
        <Fragment>
          {header}
          <Body>
            <LoadingIndicator />
          </Body>
        </Fragment>
      );
    }

    const errorAlert = resolvedErrorType ? (
      <Alert variant="danger">{resolvedErrorType}</Alert>
    ) : null;

    if (
      (!user.hasPasswordAuth && authenticators.length === 0) ||
      (isSuperuser && !isSelfHosted && validateSUForm)
    ) {
      const introText = isSuperuser
        ? t(
            'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
          )
        : t('You will need to reauthenticate to continue');

      if (!isSuperuser) {
        return (
          <Fragment>
            {header}
            <Body>
              <Stack gap="xl">
                <Text as="p">{introText}</Text>
                {errorAlert}
              </Stack>
            </Body>
            <Footer>
              <LinkButton variant="primary" href={getAuthLoginPath()}>
                {t('Continue')}
              </LinkButton>
            </Footer>
          </Fragment>
        );
      }

      const isAccessStep = superuserStep.step === 'access';

      return (
        <superuserForm.AppForm form={superuserForm}>
          {header}
          <Body>
            <Stack gap="xl">
              <Text as="p">{introText}</Text>
              {errorAlert}
              {!isSelfHosted && isAccessStep && (
                <Fragment>
                  <superuserForm.AppField name="superuserAccessCategory">
                    {field => (
                      <field.Radio.Group
                        value={field.state.value}
                        onChange={field.handleChange}
                      >
                        <field.Layout.Stack
                          label={t('Categories of Superuser Access')}
                          required
                        >
                          <Override
                            name="component:superuser-access-category"
                            RadioItem={field.Radio.Item}
                          />
                        </field.Layout.Stack>
                      </field.Radio.Group>
                    )}
                  </superuserForm.AppField>
                  <superuserForm.AppField name="superuserReason">
                    {field => (
                      <field.Layout.Stack label={t('Reason for Access')} required>
                        <field.Input
                          maxLength={128}
                          minLength={4}
                          placeholder={t('e.g. disabling SSO enforcement')}
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      </field.Layout.Stack>
                    )}
                  </superuserForm.AppField>
                </Fragment>
              )}
              {!isSelfHosted && !isAccessStep && (
                <WebAuthn
                  mode="sudo"
                  authenticators={authenticators}
                  onWebAuthn={handleWebAuthn}
                />
              )}
            </Stack>
          </Body>
          <Footer>
            {isAccessStep ? (
              <Flex width="100%" justify="between" align="center" gap="md">
                <superuserForm.SubmitButton
                  variant="secondary"
                  onClick={() => {
                    superuserForm.setFieldValue('superuserAccessCategory', 'cops_csm');
                    superuserForm.setFieldValue('superuserReason', 'COPS and CSM use');
                  }}
                >
                  {t('COPS/CSM')}
                </superuserForm.SubmitButton>
                <superuserForm.SubmitButton>{t('Continue')}</superuserForm.SubmitButton>
              </Flex>
            ) : (
              <Flex width="100%" justify="between" align="center" gap="md">
                <Button
                  variant="transparent"
                  onClick={() => {
                    superuserForm.reset();
                    setErrorType(undefined);
                    setSuperuserStep({step: 'access'});
                  }}
                >
                  {t('Change reason')}
                </Button>
                <superuserForm.SubmitButton>
                  {t('Re-authenticate')}
                </superuserForm.SubmitButton>
              </Flex>
            )}
          </Footer>
        </superuserForm.AppForm>
      );
    }

    return (
      <passwordForm.AppForm form={passwordForm}>
        {header}
        <Body>
          <Stack gap="xl">
            <Text as="p">
              {isSuperuser
                ? t(
                    'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                  )
                : t('Help us keep your account safe by confirming your identity.')}
            </Text>
            {errorAlert}
            {user.hasPasswordAuth && (
              <passwordForm.AppField name="password">
                {field => (
                  <field.Layout.Stack label={t('Password')}>
                    <field.Password
                      value={field.state.value}
                      onChange={field.handleChange}
                      autoFocus
                    />
                  </field.Layout.Stack>
                )}
              </passwordForm.AppField>
            )}
            <WebAuthn
              mode="sudo"
              authenticators={authenticators}
              onWebAuthn={handleWebAuthn}
            />
          </Stack>
        </Body>
        <Footer>
          <passwordForm.SubmitButton>{t('Confirm Password')}</passwordForm.SubmitButton>
        </Footer>
      </passwordForm.AppForm>
    );
  };

  return renderModalContent();
}

export default SudoModal;
