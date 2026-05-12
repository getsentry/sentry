import {useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {FieldGroup as FormFieldGroup} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PluginList} from 'sentry/components/pluginList';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {setApiQueryData, useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

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

function getReleaseTokenQueryKey(
  organizationSlug: string,
  projectSlug: string
): ApiQueryKey {
  return [
    getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/token/', {
      path: {organizationIdOrSlug: organizationSlug, projectIdOrSlug: projectSlug},
    }),
  ];
}

export default function ProjectReleaseTracking() {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {
    data: releaseTokenData = placeholderData,
    isFetching,
    isError,
    error,
  } = useApiQuery<TokenResponse>(
    getReleaseTokenQueryKey(organization.slug, project.slug),
    {
      staleTime: 0,
      retry: false,
    }
  );

  const {data: fetchedPlugins = [], isPending: isPluginsLoading} = useApiQuery<Plugin[]>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/', {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  const handleRegenerateToken = () => {
    api.request(`/projects/${organization.slug}/${project.slug}/releases/token/`, {
      method: 'POST',
      data: {project: project.slug},
      success: data => {
        setApiQueryData<TokenResponse>(
          queryClient,
          getReleaseTokenQueryKey(organization.slug, project.slug),
          data
        );
        addSuccessMessage(
          t(
            'Your deploy token has been regenerated. You will need to update any existing deploy hooks.'
          )
        );
      },
      error: () => {
        addErrorMessage(t('Unable to regenerate deploy token, please try again'));
      },
    });
  };

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

  if (isError && error?.status !== 403) {
    return <LoadingError />;
  }

  // Using isFetching instead of isPending to avoid showing loading indicator when 403
  if (isFetching || isPluginsLoading) {
    return <LoadingIndicator />;
  }

  const pluginList = fetchedPlugins.filter(
    (p: Plugin) => p.type === 'release-tracking' && p.hasConfiguration
  );

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
              disabled={!hasWrite}
              priority="danger"
              onConfirm={handleRegenerateToken}
              message={t(
                'Are you sure you want to regenerate your token? Your current token will no longer be usable.'
              )}
            >
              <Button variant="danger">{t('Regenerate Token')}</Button>
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

      <PluginList project={project} pluginList={pluginList} />

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
