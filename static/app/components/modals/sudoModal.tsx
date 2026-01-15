import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import trimEnd from 'lodash/trimEnd';

import {Flex} from '@sentry/scraps/layout';

import {logout} from 'sentry/actionCreators/account';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  getBoostrapTeamsQueryOptions,
  getBootstrapOrganizationQueryOptions,
  getBootstrapProjectsQueryOptions,
} from 'sentry/bootstrap/bootstrapRequests';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import SecretField from 'sentry/components/forms/fields/secretField';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {WebAuthn} from 'sentry/components/webAuthn';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import {useApiQuery, useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

interface WebAuthnParams {
  challenge: string;
  response: string;
  isSuperuserModal?: boolean;
  superuserAccessCategory?: string;
  superuserReason?: string;
}

type DefaultProps = {
  closeButton?: boolean;
};

type State = {
  error: boolean;
  errorType: string;
  showAccessForms: boolean;
  superuserAccessCategory: string;
  superuserReason: string;
};

type Props = DefaultProps &
  Pick<ModalRenderProps, 'Body' | 'Header'> & {
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

function SudoModal({
  closeModal,
  isSuperuser,
  needsReload,
  retryRequest,
  Header,
  Body,
  closeButton,
}: Props) {
  const user = useUser();
  const navigate = useNavigate();
  const params = useParams<{orgId?: string}>();
  const location = useLocation();
  const api = useApi();
  const [state, setState] = useState<State>({
    error: false,
    errorType: '',
    showAccessForms: true,
    superuserAccessCategory: '',
    superuserReason: '',
  });

  const {error, errorType, showAccessForms, superuserAccessCategory, superuserReason} =
    state;

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
  } = useApiQuery<Authenticator[]>(['/authenticators/'], {
    // Fetch authenticators after preload requests to avoid overwriting session cookie
    enabled: !bootstrapIsPending,
    staleTime: 0,
    retry: false,
    // Immeditealy refetch authenticators on window / tab focus. If a user had
    // multiple tabs open and required authentication in any other tabs we may
    // have stomped the session state the request sets, and will need to reload
    // session state immediately.
    refetchOnWindowFocus: true,
  });

  const handleSubmitCOPS = () => {
    setState(prevState => ({
      ...prevState,
      superuserAccessCategory: 'cops_csm',
      superuserReason: 'COPS and CSM use',
    }));
  };

  const handleChangeReason = (e: React.MouseEvent) => {
    // XXX(epurkhiser): We have to prevent default here to avoid react from
    // propagating this event up to the form and causing the form to be
    // submitted. This is happening because when the form is rendered the same
    // button is replaced with a button that has type="submit", this happens
    // before the event is propegated to the form, and by the time that handler
    // is run react thinks the button is type submit and will submit the form.
    //
    // See https://github.com/facebook/react/issues/8554#issuecomment-278580583
    e.preventDefault();

    setState(prevState => ({
      ...prevState,
      showAccessForms: true,
      superuserAccessCategory: '',
      superuserReason: '',
    }));
  };

  const handleSubmit = async (data: any) => {
    const disableU2FForSUForm = ConfigStore.get('disableU2FForSUForm');

    const suAccessCategory = superuserAccessCategory || data.superuserAccessCategory;

    const suReason = superuserReason || data.superuserReason;

    if (!authenticators.length && !disableU2FForSUForm) {
      handleError(ErrorCodes.NO_AUTHENTICATOR);
      return;
    }

    if (showAccessForms && isSuperuser && !disableU2FForSUForm) {
      setState(prevState => ({
        ...prevState,
        showAccessForms: false,
        superuserAccessCategory: suAccessCategory,
        superuserReason: suReason,
      }));
    } else {
      try {
        await api.requestPromise('/auth/', {method: 'PUT', data});
        handleSuccess();
      } catch (err) {
        handleError(err);
      }
    }
  };

  const handleSuccess = useCallback(() => {
    if (isSuperuser) {
      navigate(
        {pathname: location.pathname, state: {forceUpdate: new Date()}},
        {replace: true}
      );
      if (needsReload) {
        window.location.reload();
      }
      return;
    }

    if (!retryRequest) {
      closeModal();
      return;
    }

    retryRequest().then(() => {
      setState(prevState => ({...prevState, showAccessForms: true}));
      closeModal();
    });
  }, [closeModal, isSuperuser, location.pathname, navigate, needsReload, retryRequest]);

  const handleError = useCallback((err: any) => {
    let newErrorType = ''; // Create a new variable to store the error type

    if (err.status === 403) {
      if (err.responseJSON.detail.code === 'no_u2f') {
        newErrorType = ErrorCodes.NO_AUTHENTICATOR;
      } else {
        newErrorType = ErrorCodes.INVALID_PASSWORD;
      }
    } else if (err.status === 401) {
      newErrorType = ErrorCodes.INVALID_SSO_SESSION;
    } else if (err.status === 400) {
      newErrorType = ErrorCodes.INVALID_ACCESS_CATEGORY;
    } else if (err === ErrorCodes.NO_AUTHENTICATOR) {
      newErrorType = ErrorCodes.NO_AUTHENTICATOR;
    } else {
      newErrorType = ErrorCodes.UNKNOWN_ERROR;
    }

    setState(prevState => ({
      ...prevState,
      error: true,
      errorType: newErrorType,
      showAccessForms: true,
    }));
  }, []);

  const handleWebAuthn = useCallback(
    async (data: WebAuthnParams) => {
      data.isSuperuserModal = isSuperuser;
      data.superuserAccessCategory = state.superuserAccessCategory;
      data.superuserReason = state.superuserReason;
      // It's ok to throw from here, u2fInterface will handle it.
      await api.requestPromise('/auth/', {method: 'PUT', data});
      handleSuccess();
    },
    [
      api,
      handleSuccess,
      isSuperuser,
      state.superuserAccessCategory,
      state.superuserReason,
    ]
  );

  const getAuthLoginPath = (): string => {
    const authLoginPath = `/auth/login/?next=${encodeURIComponent(window.location.href)}`;
    const {superuserUrl} = window.__initialData.links;
    if (window.__initialData?.customerDomain && superuserUrl) {
      return `${trimEnd(superuserUrl, '/')}${authLoginPath}`;
    }
    return authLoginPath;
  };

  const renderBodyContent = () => {
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    const validateSUForm = ConfigStore.get('validateSUForm');

    if (errorType === ErrorCodes.INVALID_SSO_SESSION) {
      logout(api, getAuthLoginPath());
      return null;
    }

    if (authenticatorsFetching || !authenticatorsLoaded || bootstrapIsPending) {
      return <LoadingIndicator />;
    }

    if (
      (!user.hasPasswordAuth && authenticators.length === 0) ||
      (isSuperuser && !isSelfHosted && validateSUForm)
    ) {
      return (
        <Fragment>
          <StyledTextBlock>
            {isSuperuser
              ? t(
                  'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
                )
              : t('You will need to reauthenticate to continue')}
          </StyledTextBlock>
          {error && <Alert variant="danger">{errorType}</Alert>}
          {isSuperuser ? (
            <Form
              apiMethod="PUT"
              apiEndpoint="/auth/"
              submitLabel={showAccessForms ? t('Continue') : t('Re-authenticate')}
              onSubmit={handleSubmit}
              onSubmitSuccess={handleSuccess}
              onSubmitError={handleError}
              initialData={{isSuperuserModal: isSuperuser}}
              extraButton={
                <Flex align="center" margin="0 3xl">
                  {showAccessForms ? (
                    <Button type="submit" onClick={handleSubmitCOPS}>
                      {t('COPS/CSM')}
                    </Button>
                  ) : (
                    <Button borderless size="sm" onClick={handleChangeReason}>
                      {t('Change reason')}
                    </Button>
                  )}
                </Flex>
              }
              resetOnError
            >
              {!isSelfHosted && showAccessForms && (
                <Hook name="component:superuser-access-category" />
              )}
              {!isSelfHosted && !showAccessForms && (
                <WebAuthn
                  mode="sudo"
                  authenticators={authenticators}
                  onWebAuthn={handleWebAuthn}
                />
              )}
            </Form>
          ) : (
            <LinkButton priority="primary" href={getAuthLoginPath()}>
              {t('Continue')}
            </LinkButton>
          )}
        </Fragment>
      );
    }

    return (
      <Fragment>
        <StyledTextBlock>
          {isSuperuser
            ? t(
                'You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.'
              )
            : t('Help us keep your account safe by confirming your identity.')}
        </StyledTextBlock>

        {error && <Alert variant="danger">{errorType}</Alert>}

        <Form
          apiMethod="PUT"
          apiEndpoint="/auth/"
          submitLabel={t('Confirm Password')}
          onSubmitSuccess={handleSuccess}
          onSubmitError={handleError}
          hideFooter={!user.hasPasswordAuth && authenticators.length === 0}
          initialData={{isSuperuserModal: isSuperuser}}
          resetOnError
        >
          {user.hasPasswordAuth && (
            <SecretField
              inline={false}
              stacked
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}

          <WebAuthn
            mode="sudo"
            authenticators={authenticators}
            onWebAuthn={handleWebAuthn}
          />
        </Form>
      </Fragment>
    );
  };

  return (
    <Fragment>
      <Header closeButton={closeButton}>
        <h4>{t('Confirm Password to Continue')}</h4>
      </Header>
      <Body>{renderBodyContent()}</Body>
    </Fragment>
  );
}

export default SudoModal;

const StyledTextBlock = styled(TextBlock)`
  margin-bottom: ${space(1)};
`;
