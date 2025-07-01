import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DocIntegration} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import IntegrationLayout from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

export default function DocIntegrationDetailsView() {
  const tabs: IntegrationTab[] = ['overview'];
  const organization = useOrganization();
  const {integrationSlug} = useParams<{integrationSlug: string}>();

  const {data: doc, isPending} = useApiQuery<DocIntegration>(
    [`/doc-integrations/${integrationSlug}/`],
    {staleTime: Infinity, retry: false}
  );

  const integrationType = 'document';
  const description = doc?.description ?? '';
  const author = doc?.author ?? '';
  const installationStatus = null;
  const resourceLinks = useMemo(() => doc?.resources ?? [], [doc]);
  const integrationName = doc?.name ?? '';
  const featureData = useMemo(() => doc?.features ?? [], [doc]);

  useEffect(() => {
    trackIntegrationAnalytics('integrations.integration_viewed', {
      view: 'integrations_directory_integration_detail',
      integration: integrationSlug,
      integration_type: integrationType,
      already_installed: installationStatus !== 'Not Installed',
      organization,
      integration_tab: 'overview',
    });
  }, [integrationSlug, integrationType, installationStatus, organization]);

  const renderTopButton = useCallback(() => {
    if (!doc) {
      return null;
    }
    return (
      <ExternalLink
        href={doc.url}
        onClick={() => {
          trackIntegrationAnalytics('integrations.installation_start', {
            view: 'integrations_directory_integration_detail',
            integration: integrationSlug,
            integration_type: integrationType,
            already_installed: installationStatus !== 'Not Installed',
            organization,
          });
        }}
        data-test-id="learn-more"
      >
        <LearnMoreButton
          size="sm"
          priority="primary"
          style={{marginLeft: space(1)}}
          icon={<StyledIconOpen />}
        >
          {t('Learn More')}
        </LearnMoreButton>
      </ExternalLink>
    );
  }, [doc, integrationSlug, integrationType, installationStatus, organization]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!doc) {
    return <LoadingError message={t('There was an error loading this integration.')} />;
  }

  return (
    <IntegrationLayout.Body
      integrationName={integrationName}
      alert={null}
      topSection={
        <IntegrationLayout.TopSection
          featureData={featureData}
          integrationName={integrationName}
          installationStatus={installationStatus}
          integrationIcon={<DocIntegrationAvatar docIntegration={doc} size={50} />}
          addInstallButton={
            <IntegrationLayout.AddInstallButton
              featureData={featureData}
              hideButtonIfDisabled={false}
              requiresAccess={false}
              renderTopButton={renderTopButton}
            />
          }
          additionalCTA={null}
        />
      }
      tabs={<IntegrationLayout.Tabs tabs={tabs} activeTab={'overview'} />}
      content={
        <IntegrationLayout.InformationCard
          integrationSlug={integrationSlug}
          description={description}
          featureData={featureData}
          author={author}
          resourceLinks={resourceLinks}
          permissions={null}
        />
      }
    />
  );
}

const LearnMoreButton = styled(Button)`
  margin-left: ${space(1)};
`;

const StyledIconOpen = styled(IconOpen)`
  transition: 0.1s linear color;
  margin: 0 ${space(0.5)};
  position: relative;
  top: 1px;
`;
