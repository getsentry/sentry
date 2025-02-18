import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {
  BasePlatformOptions,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {
  PlatformOptionsControl,
  useUrlPlatformOptions,
} from 'sentry/components/onboarding/platformOptionsControl';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

import AddInstallationInstructions from './components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from './components/integrations/postInstallCodeSnippet';

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Auto'),
        value: InstallationMode.AUTO,
      },
      {
        label: t('Manual'),
        value: InstallationMode.MANUAL,
      },
    ],
    defaultValue: InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type Props = {
  integrationSlug: string;
  platform: PlatformIntegration;
  project: Project;
};

function IntegrationSetup({project, integrationSlug, platform}: Props) {
  const [hasError, setHasError] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);

  const organization = useOrganization();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  const {
    isLoading,
    docs: docsConfig,
    dsn,
    projectKeyId,
    refetch,
  } = useLoadGettingStarted({
    orgSlug: organization.slug,
    projSlug: project.slug,
    platform,
  });

  const selectedPlatformOptions = useUrlPlatformOptions(docsConfig?.platformOptions);

  const api = useApi();
  const fetchData = useCallback(() => {
    if (!integrationSlug) {
      return Promise.resolve();
    }

    const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`;
    return api
      .requestPromise(endpoint)
      .then(integrations => {
        setProvider(integrations.providers[0]);
        setHasError(false);
      })
      .catch(error => {
        setHasError(true);
        throw error;
      });
  }, [integrationSlug, api, organization.slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadingError = (
    <LoadingError
      message={t('Failed to load the integration for the %s platform.', platform.name)}
      onRetry={fetchData}
    />
  );

  const testOnlyAlert = (
    <Alert.Container>
      <Alert type="warning">
        Platform documentation is not rendered in for tests in CI
      </Alert>
    </Alert.Container>
  );

  const renderIntegrationInstructions = () => {
    if (!provider) {
      return null;
    }

    return (
      <Fragment>
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {tct(
            "Don't have have permissions to create a Cloudformation stack? [link:Invite your team instead].",
            {
              link: (
                <Button
                  priority="link"
                  onClick={() => {
                    openInviteMembersModal();
                  }}
                  aria-label={t('Invite your team instead')}
                />
              ),
            }
          )}
        </motion.p>
        <motion.div
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          <AddInstallationInstructions />
        </motion.div>

        <motion.div
          initial={{opacity: 0, y: 40}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 40}}
        >
          <AddIntegrationButton
            provider={provider}
            onAddIntegration={() => setInstalled(true)}
            organization={organization}
            priority="primary"
            size="sm"
            analyticsParams={{view: 'onboarding', already_installed: false}}
            modalParams={{projectId: project.id}}
          />
        </motion.div>
      </Fragment>
    );
  };

  const renderPostInstallInstructions = () => {
    if (!provider) {
      return null;
    }
    return (
      <Fragment>
        <PostInstallCodeSnippet
          provider={provider}
          platform={project.platform}
          isOnboarding
        />
        <ExternalLink
          onClick={() => {
            trackAnalytics('growth.onboarding_view_full_docs', {
              organization,
            });
          }}
          href="https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/"
        >
          {t('View Full Documentation')}
        </ExternalLink>
      </Fragment>
    );
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!docsConfig || !dsn || !projectKeyId) {
    return (
      <LoadingError
        message={t(
          'The getting started documentation for this platform is currently unavailable.'
        )}
        onRetry={refetch}
      />
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: platform.id,
    projectId: project.id,
    projectSlug: project.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    isSelfHosted,
    platformOptions: selectedPlatformOptions,
    sourcePackageRegistries: {
      isLoading: false,
      data: undefined,
    },
    urlPrefix,
  };

  return (
    <Fragment>
      <SetupIntroduction
        stepHeaderText={t('Automatically instrument %s SDK', platform.name)}
        platform={platform.id}
      />
      <PlatformOptionsControl
        platformOptions={platformOptions}
        onChange={docsConfig.onboarding.onPlatformOptionsChange?.(docParams)}
      />
      <Divider />
      {installed ? renderPostInstallInstructions() : renderIntegrationInstructions()}
      {getDynamicText({
        value: !hasError ? null : loadingError,
        fixed: testOnlyAlert,
      })}
    </Fragment>
  );
}

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  margin-bottom: ${space(3)};
`;

export default IntegrationSetup;
