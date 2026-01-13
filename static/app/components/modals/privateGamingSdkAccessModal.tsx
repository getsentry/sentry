import {Fragment, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Prose} from '@sentry/scraps/text/prose';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
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
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';

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
  gamingPlatform?: GamingPlatform;
  onSubmit?: () => void;
  projectId?: string;
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
  const [gamingPlatforms, setGamingPlatforms] = useState<GamingPlatform[]>(
    gamingPlatform ? [gamingPlatform] : []
  );
  const [submittedPlatforms, setSubmittedPlatforms] = useState<GamingPlatform[]>([]);
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const queryClient = useQueryClient();

  // Old hooks and flags
  const hasNewGitHubFlow = organization.features.includes(
    'github-console-sdk-self-invite'
  );
  const user = useUser();
  const [githubProfile, setGithubProfile] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | undefined>(undefined);

  const {
    isPending,
    isError,
    data: userIdentities,
    refetch,
  } = useApiQuery<UserIdentityConfig[]>(['/users/me/user-identities/'], {
    staleTime: 5000,
  });

  const mutation = useMutation<
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
      }

      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/console-sdk-invites/`],
      });
    },
    onError: errorResponse => {
      const errorMessage = tct('[error] - [detail]', {
        error:
          typeof errorResponse.responseJSON?.error === 'string'
            ? errorResponse.responseJSON.error
            : t('Error occurred'),
        detail:
          typeof errorResponse.responseJSON?.detail === 'string'
            ? errorResponse.responseJSON.detail
            : t('Unknown Error occurred'),
      });
      addErrorMessage(errorMessage);
    },
  });

  const hasGithubIdentity = userIdentities?.some(
    userIdentity => userIdentity.provider.key === 'github'
  );
  const isFormValid = hasNewGitHubFlow
    ? hasGithubIdentity && gamingPlatforms.length > 0
    : !!githubProfile.trim() && gamingPlatforms.length > 0;
  const showSuccessView = mutation.isSuccess && submittedPlatforms.length > 0;

  // Derive projectSlug and sdkName from available data for old flow
  const sdkName =
    gamingPlatform && CONSOLE_PLATFORM_METADATA[gamingPlatform]
      ? CONSOLE_PLATFORM_METADATA[gamingPlatform].displayName
      : 'Console';

  useEffect(() => {
    trackAnalytics('gaming.private_sdk_access_modal_opened', {
      platform: gamingPlatform,
      project_id: projectId,
      organization,
      origin,
    });
  }, [gamingPlatform, organization, projectId, origin]);

  // Old submit handler using Sentry.sendFeedback
  async function handleSubmitOldFlow() {
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setRequestError(undefined);

    trackAnalytics('gaming.private_sdk_access_modal_submitted', {
      platforms: gamingPlatforms,
      project_id: projectId,
      platform: gamingPlatform,
      organization,
      origin,
    });

    onSubmit?.();

    const platformOptions = Object.entries(CONSOLE_PLATFORM_METADATA).map(
      ([value, metadata]) => ({
        value,
        label: metadata.displayName,
      })
    );

    const messageBody = [
      `This is a request for SDK access for consoles. The user's details are:`,
      `User: ${user.name}`,
      `Email: ${user.email}`,
      gamingPlatforms.length === 1
        ? `Platform: ${gamingPlatforms[0]}`
        : `Platforms: ${gamingPlatforms
            .map(
              (platform: string) =>
                platformOptions.find(option => option.value === platform)?.label ||
                platform
            )
            .join(', ')}`,
      `Org Slug: ${organization.slug}`,
      `GitHub Profile: ${githubProfile}`,
    ].join('\n');

    try {
      await Sentry.sendFeedback(
        {
          message: messageBody,
          name: user.name,
          email: user.email,
          tags: {
            feature: 'console-sdk-access',
          },
        },
        {
          captureContext: {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              name: user.name,
            },
          },
        }
      );

      addSuccessMessage(
        tct('Your [sdkName] SDK access request has been submitted.', {
          sdkName,
        })
      );
      closeModal();
    } catch (error: any) {
      handleXhrErrorResponse(t('Unable to submit SDK access request'), error);

      setRequestError(
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

  // New submit handler using API
  function handleSubmitNewFlow() {
    if (!isFormValid) {
      return;
    }

    trackAnalytics('gaming.private_sdk_access_modal_submitted', {
      platform: gamingPlatform,
      project_id: projectId,
      organization,
      origin,
      platforms: gamingPlatforms,
    });

    onSubmit?.();
    mutation.mutate({platforms: gamingPlatforms});
  }

  function handleSubmit() {
    if (hasNewGitHubFlow) {
      handleSubmitNewFlow();
    } else {
      handleSubmitOldFlow();
    }
  }

  return (
    <Fragment>
      <Header closeButton>
        <h3>{tct('Request [sdkName] SDK Access', {sdkName})}</h3>
      </Header>
      <Body>
        {hasNewGitHubFlow ? (
          // New flow with GitHub OAuth
          <Fragment>
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
                        <ExternalLink href={metadata?.repoURL}>
                          {metadata?.displayName}
                        </ExternalLink>
                      </li>
                    );
                  })}
                </ul>
              </Prose>
            ) : isPending ? (
              <LoadingIndicator />
            ) : isError ? (
              <LoadingError onRetry={refetch} />
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
                  value={gamingPlatforms}
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
                    const pathWithReopenFlag = `${currentPath}${separator}reopenGamingSdkModal=1`;
                    window.location.href = `/identity/login/github/?next=${encodeURIComponent(pathWithReopenFlag)}`;
                  }}
                >
                  {t('Log in with GitHub')}
                </Button>
              </Fragment>
            )}
            {mutation.error && (
              <Alert variant="danger">
                {tct('[error] - [detail]', {
                  error:
                    typeof mutation.error.responseJSON?.error === 'string'
                      ? mutation.error.responseJSON.error
                      : t('Error occurred'),
                  detail:
                    typeof mutation.error.responseJSON?.detail === 'string'
                      ? mutation.error.responseJSON.detail
                      : t('Unknown Error occurred'),
                })}
              </Alert>
            )}
          </Fragment>
        ) : (
          // Old flow with manual GitHub profile input
          <Fragment>
            <p>
              {gamingPlatform
                ? tct(
                    'Request access to our [sdkName] SDK. Please provide your GitHub profile.',
                    {sdkName}
                  )
                : tct(
                    'Request access to our [sdkName] SDK. Please provide your GitHub profile and the gaming platforms you work with.',
                    {sdkName}
                  )}
            </p>
            <TextField
              name="githubProfile"
              label={t('Link to your GitHub profile')}
              placeholder="https://github.com/username"
              value={githubProfile}
              onChange={setGithubProfile}
              required
              stacked
              inline={false}
            />
            {!gamingPlatform && (
              <SelectField
                name="gamingPlatforms"
                label={t('Select Gaming Platform')}
                placeholder={t('Select one or more gaming platforms')}
                options={Object.entries(CONSOLE_PLATFORM_METADATA).map(
                  ([value, metadata]) => ({
                    value,
                    label: metadata.displayName,
                  })
                )}
                value={gamingPlatforms}
                onChange={setGamingPlatforms}
                multiple
                required
                stacked
                inline={false}
              />
            )}
            {requestError && <Alert variant="danger">{requestError}</Alert>}
          </Fragment>
        )}
      </Body>
      <Footer>
        <ButtonBar>
          {hasNewGitHubFlow ? (
            // New flow footer
            showSuccessView ? (
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
                    busy={mutation.isPending}
                  >
                    {mutation.isPending ? t('Sending Invitation') : t('Send Invitation')}
                  </Button>
                )}
              </Fragment>
            )
          ) : (
            // Old flow footer
            <Fragment>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              <Button
                priority="primary"
                onClick={handleSubmit}
                disabled={!isFormValid}
                busy={isSubmitting}
              >
                {isSubmitting ? t('Submitting…') : t('Submit Request')}
              </Button>
            </Fragment>
          )}
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
