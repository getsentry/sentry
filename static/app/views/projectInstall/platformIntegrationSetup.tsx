import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import AddInstallationInstructions from 'sentry/views/onboarding/components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from 'sentry/views/onboarding/components/integrations/postInstallCodeSnippet';
import {PlatformDocHeader} from 'sentry/views/projectInstall/platformDocHeader';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

import FirstEventFooter from './components/firstEventFooter';

interface PlatformIntegrationSetupProps {
  integrationSlug: string;
  loading: boolean;
  onClickManualSetup: () => void;
  platform: PlatformIntegration | undefined;
  project: Project | undefined;
}

export function PlatformIntegrationSetup({
  project,
  platform,
  onClickManualSetup,
  integrationSlug,
  loading,
}: PlatformIntegrationSetupProps) {
  const organization = useOrganization();
  const [installed, setInstalled] = useState(false);
  const navigate = useNavigate();

  const {
    data: integrations,
    isPending,
    isError,
    refetch,
  } = useApiQuery<{providers: IntegrationProvider[]}>(
    [
      `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`,
    ],
    {
      enabled: !!integrationSlug,
      staleTime: 0,
    }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    // redirect if platform is not known.
    if ((!platform || platform.id === 'other') && !!project?.slug) {
      navigate(
        normalizeUrl(
          `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`
        )
      );
    }
  }, [platform, organization.slug, navigate, project?.slug]);

  const isLoading = isPending || loading;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const provider = integrations?.providers.length ? integrations.providers[0] : null;

  if (!provider || !platform || !project) {
    return null;
  }

  return (
    <OuterWrapper>
      <InnerWrapper>
        <PlatformDocHeader
          platform={{
            key: platform.id,
            id: platform.id,
            name: platform.name,
            link: platform.link,
          }}
          projectSlug={project.slug}
          title={t('Automatically instrument %s', platform.name)}
        />
        {!installed ? (
          <Fragment>
            <AddInstallationInstructions />
            <StyledButtonBar gap={1}>
              <AddIntegrationButton
                provider={provider}
                onAddIntegration={() => setInstalled(true)}
                organization={organization}
                priority="primary"
                size="sm"
                analyticsParams={{view: 'project_creation', already_installed: false}}
                modalParams={{projectId: project.id}}
                aria-label={t('Add integration')}
              />
              <Button
                size="sm"
                onClick={() => {
                  onClickManualSetup();
                  trackAnalytics('integrations.switch_manual_sdk_setup', {
                    integration_type: 'first_party',
                    integration: integrationSlug,
                    view: 'project_creation',
                    organization,
                  });
                }}
              >
                {t('Manual Setup')}
              </Button>
            </StyledButtonBar>
          </Fragment>
        ) : (
          <Fragment>
            <PostInstallCodeSnippet provider={provider} />
            <FirstEventFooter
              project={project}
              organization={organization}
              docsLink={
                // TODO: make dynamic when adding more integrations
                'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/'
              }
              docsOnClick={() =>
                trackAnalytics('growth.onboarding_view_full_docs', {organization})
              }
            />
          </Fragment>
        )}
      </InnerWrapper>
    </OuterWrapper>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const InnerWrapper = styled('div')`
  max-width: 850px;
`;

const OuterWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 50px;
`;
