import {Fragment, useEffect, useState} from 'react';
import {IconGithub} from '@sentry/icons/github';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {type ModalRenderProps} from '@sentry/scraps/modal';
import {Prose} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {t, tct} from 'sentry/locale';
import type {UserIdentityConfig} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';

const GAMING_PLATFORMS = ['playstation', 'xbox', 'nintendo-switch'] as const;

type GamingPlatform = (typeof GAMING_PLATFORMS)[number];

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

const schema = z.object({
  platforms: z
    .array(z.enum(GAMING_PLATFORMS))
    .min(1, t('Select at least one gaming platform')),
});

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
  const [submittedPlatforms, setSubmittedPlatforms] = useState<GamingPlatform[]>([]);
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const queryClient = useQueryClient();

  const {
    isPending,
    isError,
    data: userIdentities,
    refetch,
  } = useQuery(
    apiOptions.as<UserIdentityConfig[]>()('/users/$userId/user-identities/', {
      path: {userId: 'me'},
      staleTime: Infinity,
    })
  );

  const mutation = useMutation({
    mutationFn: ({platforms}: ConsoleSdkInviteRequest) =>
      fetchMutation<ConsoleSdkInviteResponse>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/console-sdk-invites/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {platforms},
      }),
    onSuccess: (response, {platforms}) => {
      const platformsWithErrors = response.errors?.map(e => e.platform) ?? [];
      const successfulPlatforms = platforms.filter(
        platform => !platformsWithErrors.includes(platform)
      );

      if (platformsWithErrors.length > 0) {
        toast.error(
          tct(
            'Invitation to console repositories for these platforms have failed: [errors]',
            {errors: platformsWithErrors.join(',')}
          )
        );
      }

      if (successfulPlatforms.length > 0) {
        toast.success(
          tct('Invitation to these platforms has been sent: [platforms]', {
            platforms: successfulPlatforms.join(','),
          })
        );
        setSubmittedPlatforms(successfulPlatforms);
      }

      queryClient.invalidateQueries(
        apiOptions.queryFilter(
          '/organizations/$organizationIdOrSlug/console-sdk-invites/',
          {path: {organizationIdOrSlug: organization.slug}}
        )
      );
    },
    onError: error => {
      const response = error instanceof RequestError ? error.responseJSON : undefined;
      toast.error(
        tct('[error] - [detail]', {
          error:
            typeof response?.error === 'string' ? response.error : t('Error occurred'),
          detail:
            typeof response?.detail === 'string'
              ? response.detail
              : t('Unknown Error occurred'),
        })
      );
    },
  });

  const defaultValues: z.infer<typeof schema> = {
    platforms: gamingPlatform ? [gamingPlatform] : [],
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      trackAnalytics('gaming.private_sdk_access_modal_submitted', {
        platform: gamingPlatform,
        project_id: projectId,
        organization,
        origin,
        platforms: value.platforms,
      });

      onSubmit?.();
      return mutation.mutateAsync({platforms: value.platforms}).catch(() => {});
    },
  });

  const platformOptions = (organization.enabledConsolePlatforms ?? []).flatMap(value => {
    const platform = GAMING_PLATFORMS.find(p => p === value);
    return platform
      ? [{value: platform, label: CONSOLE_PLATFORM_METADATA[platform].displayName}]
      : [];
  });

  const hasGithubIdentity = userIdentities?.some(
    userIdentity => userIdentity.provider.key === 'github'
  );
  const showSuccessView = mutation.isSuccess && submittedPlatforms.length > 0;

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

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h3>{tct('Request [sdkName] SDK Access', {sdkName})}</h3>
      </Header>
      <Body>
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
              <form.AppField name="platforms">
                {field => (
                  <field.Layout.Stack label={t('Select Gaming Platforms')} required>
                    <field.Select
                      multiple
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={platformOptions}
                      placeholder={t('Select one or more gaming platforms')}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Fragment>
          ) : (
            <Fragment>
              <p>
                {t(
                  'To request SDK access, you need to link your GitHub account with your Sentry account.'
                )}
              </p>
              <Button
                variant="primary"
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
        </Fragment>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          {showSuccessView ? (
            <Button variant="primary" onClick={closeModal}>
              {t('Done')}
            </Button>
          ) : (
            <Fragment>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              {hasGithubIdentity && (
                <form.SubmitButton>{t('Send Invitation')}</form.SubmitButton>
              )}
            </Fragment>
          )}
        </Grid>
      </Footer>
    </form.AppForm>
  );
}
