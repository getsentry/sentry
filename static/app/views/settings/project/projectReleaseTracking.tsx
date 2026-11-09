import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/codeBlock';
import {Confirm} from '@sentry/scraps/confirm';
import {FieldGroup as FormFieldGroup} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {useProjectSettingsOutlet} from './projectSettingsLayout';

type TokenResponse = {
  token: string;
  webhookUrl: string;
};

const TOKEN_PLACEHOLDER = 'YOUR_TOKEN';
const WEBHOOK_PLACEHOLDER = 'YOUR_WEBHOOK_URL';
const placeholderData = {
  token: TOKEN_PLACEHOLDER,
  webhookUrl: WEBHOOK_PLACEHOLDER,
};

function releaseTokenOptions(organizationSlug: string, projectSlug: string) {
  return apiOptions.as<TokenResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/token/',
    {
      path: {organizationIdOrSlug: organizationSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );
}

export default function ProjectReleaseTracking() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {
    data: releaseTokenData = placeholderData,
    isFetching,
    isError,
    error,
  } = useQuery({...releaseTokenOptions(organization.slug, project.slug), retry: false});

  const {mutate: regenerateToken, isPending: isRegenerating} = useMutation({
    mutationFn: () =>
      fetchMutation<TokenResponse>({
        method: 'POST',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/token/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}}
        ),
        data: {project: project.slug},
      }),
    onSuccess: data => {
      queryClient.setQueryData(
        releaseTokenOptions(organization.slug, project.slug).queryKey,
        oldData => ({...oldData, json: data, headers: oldData?.headers ?? {}})
      );
      toast.success(
        t(
          'Your deploy token has been regenerated. You will need to update any existing deploy hooks.'
        )
      );
    },
    onError: () => {
      toast.error(t('Unable to regenerate deploy token, please try again'));
    },
  });

  function getReleaseWebhookInstructions() {
    return (
      'curl ' +
      releaseTokenData?.webhookUrl +
      ' \\' +
      '\n  ' +
      '-X POST \\' +
      '\n  ' +
      "-H 'Content-Type: application/json' \\" +
      '\n  ' +
      '-d \'{"version": "abcdefg"}\''
    );
  }

  if (isError && (!(error instanceof RequestError) || error.status !== 403)) {
    return <LoadingError />;
  }

  // Using isFetching instead of isPending to avoid showing loading indicator when 403
  if (isFetching) {
    return <LoadingIndicator />;
  }

  const hasWrite = hasEveryAccess(['project:write'], {organization, project});
  return (
    <SentryDocumentTitle title={t('Releases')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('Release Tracking')}
        subtitle={t(
          'Configure release tracking for this project to automatically record new releases of your application.'
        )}
      />

      {!hasWrite && (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t(
              'You do not have sufficient permissions to access Release tokens, placeholders are displayed below.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <FormFieldGroup title={t('Client Configuration')}>
        <Stack gap="xl">
          <Text as="p">
            {tct(
              'Start by binding the [code:release] attribute in your application, take a look at [link:our docs] to see how to configure this for the SDK you are using.',
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/releases/" />
                ),
              }
            )}
          </Text>
          <Text as="p">
            {t(
              "This will annotate each event with the version of your application, as well as automatically create a release entity in the system the first time it's seen."
            )}
          </Text>
          <Text as="p">
            {t(
              'In addition you may configure a release hook (or use our API) to push a release and include additional metadata with it.'
            )}
          </Text>
        </Stack>
      </FormFieldGroup>

      <FormFieldGroup title={t('Deploy Token')}>
        <FieldGroup
          label={t('Token')}
          help={t('A unique secret which is used to generate deploy hook URLs')}
          hideControlState
        >
          <TextCopyInput aria-label={t('Token')}>{releaseTokenData.token}</TextCopyInput>
        </FieldGroup>

        <FieldGroup
          label={t('Regenerate Token')}
          help={t(
            'If a service becomes compromised, you should regenerate the token and re-configure any deploy hooks with the newly generated URL.'
          )}
          hideControlState
        >
          <Container>
            <Confirm
              disabled={!hasWrite || isRegenerating}
              priority="danger"
              onConfirm={() => regenerateToken()}
              message={t(
                'Are you sure you want to regenerate your token? Your current token will no longer be usable.'
              )}
            >
              <Button variant="danger" busy={isRegenerating}>
                {t('Regenerate Token')}
              </Button>
            </Confirm>
          </Container>
        </FieldGroup>
      </FormFieldGroup>

      <FormFieldGroup title={t('Webhook')}>
        <FieldGroup
          label={t('Webhook URL')}
          help={t(
            'If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.'
          )}
          inline={false}
          hideControlState
        >
          <TextCopyInput aria-label={t('Webhook URL')}>
            {releaseTokenData.webhookUrl}
          </TextCopyInput>
        </FieldGroup>

        <FieldGroup
          label={t('Request Example')}
          help={t(
            'The release webhook accepts the same parameters as the "Create a new Release" API endpoint.'
          )}
          inline={false}
          hideControlState
        >
          <CodeBlock language="bash">{getReleaseWebhookInstructions()}</CodeBlock>
        </FieldGroup>
      </FormFieldGroup>

      <FormFieldGroup title={t('API')}>
        <Stack gap="xl">
          <Text as="p">
            {t(
              'You can notify Sentry when you release new versions of your application via our HTTP API.'
            )}
          </Text>
          <Text as="p">
            {tct('See the [link:releases documentation] for more information.', {
              link: <ExternalLink href="https://docs.sentry.io/workflow/releases/" />,
            })}
          </Text>
        </Stack>
      </FormFieldGroup>
    </SentryDocumentTitle>
  );
}
