import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import AutoSelectText from 'sentry/components/autoSelectText';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PluginList from 'sentry/components/pluginList';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
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
  return [`/projects/${organizationSlug}/${projectSlug}/releases/token/`];
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
    [`/projects/${organization.slug}/${project.slug}/plugins/`],
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

  function getReleaseWebhookIntructions() {
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
    <div>
      <SentryDocumentTitle title={t('Releases')} projectSlug={project.slug} />
      <SettingsPageHeader title={t('Release Tracking')} />
      <TextBlock>
        {t(
          'Configure release tracking for this project to automatically record new releases of your application.'
        )}
      </TextBlock>

      {!hasWrite && (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t(
              'You do not have sufficient permissions to access Release tokens, placeholders are displayed below.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <Panel>
        <PanelHeader>{t('Client Configuration')}</PanelHeader>
        <PanelBody withPadding>
          <p>
            {tct(
              'Start by binding the [release] attribute in your application, take a look at [link] to see how to configure this for the SDK you are using.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/releases/">
                    our docs
                  </ExternalLink>
                ),
                release: <code>release</code>,
              }
            )}
          </p>
          <p>
            {t(
              "This will annotate each event with the version of your application, as well as automatically create a release entity in the system the first time it's seen."
            )}
          </p>
          <p>
            {t(
              'In addition you may configure a release hook (or use our API) to push a release and include additional metadata with it.'
            )}
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Deploy Token')}</PanelHeader>
        <PanelBody>
          <FieldGroup
            label={t('Token')}
            help={t('A unique secret which is used to generate deploy hook URLs')}
          >
            <TextCopyInput>{releaseTokenData.token}</TextCopyInput>
          </FieldGroup>
          <FieldGroup
            label={t('Regenerate Token')}
            help={t(
              'If a service becomes compromised, you should regenerate the token and re-configure any deploy hooks with the newly generated URL.'
            )}
          >
            <div>
              <Confirm
                disabled={!hasWrite}
                priority="danger"
                onConfirm={handleRegenerateToken}
                message={t(
                  'Are you sure you want to regenerate your token? Your current token will no longer be usable.'
                )}
              >
                <Button priority="danger">{t('Regenerate Token')}</Button>
              </Confirm>
            </div>
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Webhook')}</PanelHeader>
        <PanelBody withPadding>
          <p>
            {t(
              'If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.'
            )}
          </p>

          <AutoSelectText>
            <pre>{releaseTokenData?.webhookUrl}</pre>
          </AutoSelectText>

          <p>
            {t(
              'The release webhook accepts the same parameters as the "Create a new Release" API endpoint.'
            )}
          </p>

          <AutoSelectText>
            <pre>{getReleaseWebhookIntructions()}</pre>
          </AutoSelectText>
        </PanelBody>
      </Panel>

      <PluginList project={project} pluginList={pluginList} />

      <Panel>
        <PanelHeader>{t('API')}</PanelHeader>
        <PanelBody withPadding>
          <p>
            {t(
              'You can notify Sentry when you release new versions of your application via our HTTP API.'
            )}
          </p>

          <p>
            {tct('See the [link:releases documentation] for more information.', {
              link: <ExternalLink href="https://docs.sentry.io/workflow/releases/" />,
            })}
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
