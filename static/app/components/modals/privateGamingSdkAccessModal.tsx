import {Fragment, useEffect, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {UserIdentityConfig} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';

export type GamingPlatform = 'playstation' | 'xbox' | 'nintendo-switch';

interface ConsoleSdkInviteErrorResponse {
  detail: string;
  error: string;
}

interface ConsoleSdkInvitePlatformError {
  error: string;
  platform: string;
}

interface ConsoleSdkInviteResponse {
  errors: ConsoleSdkInvitePlatformError[] | null;
  success: true;
}

interface ConsoleSdkInviteRequest {
  platforms: GamingPlatform[];
}

export interface PrivateGamingSdkAccessModalProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings' | 'org-settings';
  projectId: string;
  gamingPlatform?: GamingPlatform;
  onSubmit?: () => void;
}

export function PrivateGamingSdkAccessModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  gamingPlatform,
  projectId,
  onSubmit,
  origin,
}: PrivateGamingSdkAccessModalProps & ModalRenderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gamingPlatforms, setGamingPlatforms] = useState<GamingPlatform[]>(
    gamingPlatform ? [gamingPlatform] : []
  );
  const [requestError, setRequestError] = useState<string | undefined>(undefined);
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const queryClient = useQueryClient();

  const {isPending, data: userIdentities} = useApiQuery<UserIdentityConfig[]>(
    ['/users/me/user-identities/'],
    {
      staleTime: Infinity,
    }
  );

  const {mutate} = useMutation<
    ConsoleSdkInviteResponse,
    ConsoleSdkInviteErrorResponse,
    ConsoleSdkInviteRequest
  >({
    mutationFn: ({platforms}: ConsoleSdkInviteRequest) =>
      fetchMutation({
        url: `/organizations/${organization.slug}/console-sdk-invites/`,
        method: 'POST',
        data: {platforms},
      }),
    onSuccess: (response, {platforms}) => {
      const platformsWithErrors = response.errors?.map(e => e.platform) ?? [];
      if (platformsWithErrors) {
        addErrorMessage(
          tct(
            'Invitation to console repositories for these platforms have failed: [errors]',
            {
              errors: platformsWithErrors.join(','),
            }
          )
        );
      }
      addSuccessMessage(
        tct('Invitation to these platforms has been sent: [platforms]', {
          platforms: platforms
            .filter(platform => !platformsWithErrors.includes(platform))
            .join(','),
        })
      );
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/console-sdk-invites/`],
      });
    },
    onError: errorResponse => {
      addErrorMessage(
        tct('[error] [detail]', {
          error: errorResponse.error,
          detail: errorResponse.detail,
        })
      );
    },
  });

  const hasGithubIdentity = userIdentities?.some(
    userIdentity => userIdentity.provider.key === 'github'
  );
  const isFormValid = hasGithubIdentity && gamingPlatforms.length > 0;
  const readableConsoleNames = new Map([
    ['nintendo-switch', 'Nintendo Switch'],
    ['playstation', 'PlayStation'],
    ['xbox', 'Xbox'],
  ]);

  useEffect(() => {
    trackAnalytics('gaming.private_sdk_access_modal_opened', {
      platform: gamingPlatform,
      project_id: projectId,
      organization,
      origin,
    });
  }, [gamingPlatform, organization, projectId, origin]);

  function handleSubmit() {
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setRequestError(undefined);

    trackAnalytics('gaming.private_sdk_access_modal_submitted', {
      platform: gamingPlatform,
      project_id: projectId,
      organization,
      origin,
      platforms: gamingPlatforms,
    });

    onSubmit?.();

    try {
      mutate({platforms: gamingPlatforms});
      closeModal();
    } catch (error: any) {
      handleXhrErrorResponse(t('Unable to submit SDK access request'), error);

      setRequestError(
        // Ideally, we’d get an error code to use with our translation functions for showing the right message, but the API currently only returns a plain string.
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : t(
                'Unable to submit the request. This could be because of network issues, or because you are using an ad-blocker.'
              )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function stringToConsoleOption(value: string): {label: string; value: string} {
    return {
      value,
      label: readableConsoleNames.get(value) ?? value,
    };
  }

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Request console SDK Access')}</h3>
      </Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : hasGithubIdentity ? (
          <Fragment>
            <p>
              {t(
                'Select the gaming platforms you need access to. You will receive GitHub repository invitations for each platform.'
              )}
            </p>
            <SelectField
              name="gamingPlatforms"
              label={t('Select Gaming Platforms')}
              placeholder={t('Select one or more gaming platforms')}
              options={organization.enabledConsolePlatforms?.map(stringToConsoleOption)}
              defaultValue={gamingPlatforms.map(stringToConsoleOption)}
              onChange={setGamingPlatforms}
              multiple
              required
              stacked
              inline={false}
            />
            {requestError && <Alert type="error">{requestError}</Alert>}
          </Fragment>
        ) : (
          <Fragment>
            <p>
              {t(
                'To request SDK access, you need to link your GitHub account with your Sentry account.'
              )}
            </p>
            <Button
              priority="primary"
              icon={<IconGithub />}
              onClick={() => {
                const separator = currentPath.includes('?') ? '&' : '?';
                const pathWithReopenFlag = `${currentPath}${separator}reopenGamingSdkModal=true`;
                window.location.href = `/identity/login/github/?next=${encodeURIComponent(pathWithReopenFlag)}`;
              }}
            >
              {t('Log in with GitHub')}
            </Button>
          </Fragment>
        )}
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          {hasGithubIdentity && (
            <Button
              priority="primary"
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              busy={isSubmitting}
            >
              {isSubmitting ? t('Sending Invitation') : t('Send Invitation')}
            </Button>
          )}
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
