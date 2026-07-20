import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

interface LegacyWebhookResponse {
  enabled: boolean;
  urls: string[];
}

export default function LegacyWebhookDetails() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const queryClient = useQueryClient();

  const webhookQueryOptions = apiOptions.as<LegacyWebhookResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/legacy-webhooks/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
      },
      staleTime: 0,
    }
  );

  const {data, isPending, isError, refetch} = useQuery(webhookQueryOptions);

  const [urlsText, setUrlsText] = useState<string | null>(null);
  const displayText = urlsText ?? data?.urls.join('\n') ?? '';

  const toggleMutation = useMutation({
    mutationFn: (shouldEnable: boolean) => {
      addLoadingMessage(shouldEnable ? t('Enabling…') : t('Disabling…'));
      return fetchMutation<LegacyWebhookResponse>({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
        data: {urls: data?.urls ?? [], enabled: shouldEnable},
      });
    },
    onSuccess: (responseData, shouldEnable) => {
      addSuccessMessage(shouldEnable ? t('Webhooks enabled') : t('Webhooks disabled'));
      queryClient.setQueryData(webhookQueryOptions.queryKey, {
        json: responseData,
        headers: {},
      });
    },
    onError: (_error, shouldEnable) => {
      addErrorMessage(
        shouldEnable ? t('Could not enable webhooks.') : t('Could not disable webhooks.')
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: (urls: string[]) => {
      addLoadingMessage(t('Saving changes…'));
      return fetchMutation<LegacyWebhookResponse>({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/legacy-webhooks/`,
        data: {urls, enabled: data?.enabled ?? true},
      });
    },
    onSuccess: responseData => {
      addSuccessMessage(t('Webhook URLs saved successfully.'));
      setUrlsText(null);
      queryClient.setQueryData(webhookQueryOptions.queryKey, {
        json: responseData,
        headers: {},
      });
    },
    onError: () => {
      addErrorMessage(t('Unable to save webhook URLs.'));
    },
  });

  const testMutation = useMutation({
    mutationFn: () => {
      addLoadingMessage(t('Sending test event…'));
      return fetchMutation({
        method: 'POST',
        url: `/organizations/${organization.slug}/test-fire-actions/`,
        data: {
          actions: [
            {
              type: 'webhook',
              data: {},
              config: {target_identifier: 'webhooks'},
            },
          ],
          projectSlug: project.slug,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Test event sent successfully.'));
    },
    onError: () => {
      addErrorMessage(t('Failed to send test event.'));
    },
  });

  const handleSave = () => {
    const urls = displayText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);
    saveMutation.mutate(urls);
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const enabled = data?.enabled ?? false;
  const serverText = data?.urls.join('\n') ?? '';
  const hasUnsavedChanges = displayText !== serverText;

  return (
    <div>
      <SentryDocumentTitle title="Webhooks" projectSlug={project.slug} />
      <SettingsPageHeader title="Webhooks" />
      <Alert.Container>
        <Alert variant="warning">
          {tct(
            'We strongly recommend using an [link:internal integration] instead of legacy webhooks.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/integration-platform/internal-integration/" />
              ),
            }
          )}
        </Alert>
      </Alert.Container>
      <Panel>
        <PanelHeader hasButtons>
          <Flex align="center" flex="1">
            {t('Webhook URLs')}
          </Flex>
          <Grid flow="column" align="center" gap="md">
            <Button
              size="xs"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || toggleMutation.isPending || !enabled}
              tooltipProps={
                enabled ? undefined : {title: t('Enable webhooks to send test events')}
              }
            >
              {t('Send Test Event')}
            </Button>
            <Button
              size="xs"
              variant={enabled ? 'danger' : undefined}
              disabled={toggleMutation.isPending || saveMutation.isPending}
              onClick={() => toggleMutation.mutate(!enabled)}
            >
              {enabled ? t('Disable') : t('Enable')}
            </Button>
          </Grid>
        </PanelHeader>
        <PanelBody withPadding>
          <Stack gap="md">
            <TextArea
              autosize
              rows={4}
              maxRows={16}
              placeholder={t('Enter callback URLs (one per line)')}
              value={displayText}
              disabled={saveMutation.isPending || toggleMutation.isPending}
              onChange={e => setUrlsText(e.target.value)}
            />
            <Text variant="muted" size="sm">
              {t('Enter callback URLs to POST new events to (one per line).')}
            </Text>
            <Flex gap="md" justify="end" borderTop="primary" paddingTop="lg">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={
                  saveMutation.isPending || toggleMutation.isPending || !hasUnsavedChanges
                }
              >
                {t('Save Changes')}
              </Button>
            </Flex>
          </Stack>
        </PanelBody>
      </Panel>
    </div>
  );
}
