import {Fragment, useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import trimEnd from 'lodash/trimEnd';

import {logout} from 'sentry/actionCreators/account';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import SecretField from 'sentry/components/forms/fields/secretField';
import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import U2fContainer from 'sentry/components/u2f/u2fContainer';
import {ErrorCodes} from 'sentry/constants/superuserAccessErrors';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useUser} from 'sentry/utils/useUser';
import {OrganizationLoaderContext} from 'sentry/views/organizationContext';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type OnTapProps = NonNullable<React.ComponentProps<typeof U2fContainer>['onTap']>;

type DefaultProps = {
  closeButton?: boolean;
};

type State = {
  authenticators: Authenticator[];
  error: boolean;
  errorType: string;
  isLoading: boolean;
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
  const api = useApi();
  const [state, setState] = useState<State>({
    authenticators: [] as Authenticator[],
    error: false,
    errorType: '',
    showAccessForms: true,
    superuserAccessCategory: '',
    superuserReason: '',
    isLoading: true,
  });

  const {
    authenticators,
    error,
    errorType,
    showAccessForms,
    superuserAccessCategory,
    superuserReason,
  } = state;

  const {organizationPromise} = useContext(OrganizationLoaderContext);
  const location = useLocation();

  useEffect(() => {
    const getAuthenticators = async () => {
      try {
        // Await all preload requests
        await Promise.allSettled([
          organizationPromise,
          ...Object.values(window.__sentry_preload),
        ]);
      } catch {
        // ignore errors
      }

      // Fetch authenticators after preload requests to avoid overwriting session cookie
      try {
        const fetchedAuthenticators = await api.requestPromise('/authenticators/');
        setState(prevState => ({
          ...prevState,
          authenticators: fetchedAuthenticators ?? [],
          isLoading: false,
        }));
      } catch {
        setState(prevState => ({
          ...prevState,
          isLoading: false,
        }));
      }
    };

    getAuthenticators();
  }, [api, organizationPromise]);

  const handleSubmitCOPS = () => {
    setState(prevState => ({
      ...prevState,
      superuserAccessCategory: 'cops_csm',
      superuserReason: 'COPS and CSM use',
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

  const handleSuccess = () => {
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
  };

  const handleError = (err: any) => {
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
  };

  const handleU2fTap = async (data: Parameters<OnTapProps>[0]) => {
    try {
      data.isSuperuserModal = isSuperuser;
      data.superuserAccessCategory = state.superuserAccessCategory;
      data.superuserReason = state.superuserReason;
      await api.requestPromise('/auth/', {method: 'PUT', data});
      handleSuccess();
    } catch (err) {
      // u2fInterface relies on this
      throw err;
    }
  };

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

    if (state.isLoading) {
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
          {error && (
            <StyledAlert type="error" showIcon>
              {errorType}
            </StyledAlert>
          )}
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
                <BackWrapper>
                  <Button type="submit" onClick={handleSubmitCOPS}>
                    {t('COPS/CSM')}
                  </Button>
                </BackWrapper>
              }
              resetOnError
            >
              {!isSelfHosted && showAccessForms && (
                <Hook name="component:superuser-access-category" />
              )}
              {!isSelfHosted && !showAccessForms && (
                <U2fContainer
                  authenticators={authenticators}
                  displayMode="sudo"
                  onTap={handleU2fTap}
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

        {error && (
          <StyledAlert type="error" showIcon>
            {errorType}
          </StyledAlert>
        )}

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
            <StyledSecretField
              inline={false}
              label={t('Password')}
              name="password"
              autoFocus
              flexibleControlStateSize
            />
          )}

          <U2fContainer
            authenticators={authenticators}
            displayMode="sudo"
            onTap={handleU2fTap}
          />
        </Form>
      </Fragment>
    );
  };

  return (
    <Fragment>
      <Header closeButton={closeButton}>{t('Confirm Password to Continue')}</Header>
      <Body>{renderBodyContent()}</Body>
    </Fragment>
  );
}

export default SudoModal;

const StyledTextBlock = styled(TextBlock)`
  margin-bottom: ${space(1)};
`;

const StyledSecretField = styled(SecretField)`
  padding-left: 0;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const BackWrapper = styled('div')`
  width: 100%;
  margin-left: ${space(4)};
`;
