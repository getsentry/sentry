import {Fragment, useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Prose} from '@sentry/scraps/text/prose';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import SelectField from 'sentry/components/forms/fields/selectField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {UserIdentityConfig} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';

type GamingPlatform = 'playstation' | 'xbox' | 'nintendo-switch';

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
  const [requestError, setRequestError] = useState<React.ReactElement | undefined>(
    undefined
  );
  const [submittedPlatforms, setSubmittedPlatforms] = useState<GamingPlatform[]>([]);
  const [showSuccessView, setShowSuccessView] = useState(false);
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
    RequestError,
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
      const successfulPlatforms = platforms.filter(
        platform => !platformsWithErrors.includes(platform)
      );

      if (platformsWithErrors.length > 0) {
        addErrorMessage(
          tct(
            'Invitation to console repositories for these platforms have failed: [errors]',
            {
              errors: platformsWithErrors.join(','),
            }
          )
        );
      }

      if (successfulPlatforms.length > 0) {
        addSuccessMessage(
          tct('Invitation to these platforms has been sent: [platforms]', {
            platforms: successfulPlatforms.join(','),
          })
        );
        setSubmittedPlatforms(successfulPlatforms);
        setShowSuccessView(true);
      }

      setIsSubmitting(false);
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/console-sdk-invites/`],
      });
    },
    onError: errorResponse => {
      const errorMessage = tct('[error] - [detail]', {
        error: (errorResponse.responseJSON?.error as string) || 'Error occurred',
        detail:
          (errorResponse.responseJSON?.detail as string) || 'Unknown Error occurred',
      });
      addErrorMessage(errorMessage);
      setRequestError(errorMessage);
      setIsSubmitting(false);
    },
  });

  const hasGithubIdentity = userIdentities?.some(
    userIdentity => userIdentity.provider.key === 'github'
  );
  const isFormValid = hasGithubIdentity && gamingPlatforms.length > 0;

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
    mutate({platforms: gamingPlatforms});
  }

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Request console SDK Access')}</h3>
      </Header>
      <Body>
        {showSuccessView ? (
          <Prose>
            <p>
              {t(
                'You have been invited to our private game console SDK GitHub repositories!'
              )}
            </p>
            <p>
              {t(
                'You should get your invites in your GitHub notifications any minute. If you have notifications disabled, click the link below to access the private repos:'
              )}
            </p>
            <ul>
              {submittedPlatforms.map(platform => {
                const metadata = CONSOLE_PLATFORM_METADATA[platform];
                return (
                  <li key={platform}>
                    <a href={metadata?.repoURL} target="_blank" rel="noopener noreferrer">
                      {metadata?.displayName}
                    </a>
                  </li>
                );
              })}
            </ul>
          </Prose>
        ) : isPending ? (
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
              options={organization.enabledConsolePlatforms?.map(value => ({
                value,
                label:
                  CONSOLE_PLATFORM_METADATA[value as GamingPlatform]?.displayName ??
                  value,
              }))}
              defaultValue={gamingPlatforms}
              onChange={setGamingPlatforms}
              multiple
              required
              stacked
              inline={false}
            />
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
        {requestError && <Alert variant="danger">{requestError}</Alert>}
      </Body>
      <Footer>
        <ButtonBar>
          {showSuccessView ? (
            <Button priority="primary" onClick={closeModal}>
              {t('Done')}
            </Button>
          ) : (
            <Fragment>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              {hasGithubIdentity && (
                <Button
                  priority="primary"
                  onClick={handleSubmit}
                  disabled={!isFormValid}
                  busy={isSubmitting}
                >
                  {isSubmitting ? t('Sending Invitation') : t('Send Invitation')}
                </Button>
              )}
            </Fragment>
          )}
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
