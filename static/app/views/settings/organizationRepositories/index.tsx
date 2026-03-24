import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {AllCodeMappings} from './allCodeMappings';
import {
  ProviderDropdown,
  ScmConnectionsView,
  useScmConnectionsData,
} from './scmConnectionsView';

export default function OrganizationRepositories() {
  const organization = useOrganization();
  const {hasConnections, scmProviders, refetchIntegrations} = useScmConnectionsData();

  return (
    <AnalyticsArea name="source-code-management">
      <SentryDocumentTitle title={t('Source Code')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Source Code')}
        action={
          hasConnections ? (
            <ProviderDropdown
              providers={scmProviders}
              onAddIntegration={refetchIntegrations}
              buttonText={t('Connect Source Code')}
              size="sm"
            />
          ) : undefined
        }
      />

      <Stack gap="3xl">
        <ScmConnectionsView />
        <AllCodeMappings />
      </Stack>
    </AnalyticsArea>
  );
}
