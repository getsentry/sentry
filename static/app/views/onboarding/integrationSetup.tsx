import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IntegrationProvider, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

import AddInstallationInstructions from './components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from './components/integrations/postInstallCodeSnippet';
import SetupIntroduction from './components/setupIntroduction';

type Props = {
  integrationSlug: string;
  project: Project | null;
  onClickManualSetup?: () => void;
};

function IntegrationSetup(props: Props) {
  const [hasError, setHasError] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);

  const organization = useOrganization();

  const {project, integrationSlug} = props;

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
      message={t(
        'Failed to load the integration for the %s platform.',
        project?.platform ?? 'other'
      )}
      onRetry={fetchData}
    />
  );

  const testOnlyAlert = (
    <Alert type="warning">
      Platform documentation is not rendered in for tests in CI
    </Alert>
  );

  const renderSetupInstructions = () => {
    const currentPlatform = project?.platform ?? 'other';
    return (
      <SetupIntroduction
        stepHeaderText={t(
          'Automatically instrument %s',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
    );
  };
  const renderIntegrationInstructions = () => {
    if (!provider || !project) {
      return null;
    }

    return (
      <Fragment>
        {renderSetupInstructions()}
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

        <DocsWrapper>
          <StyledButtonBar gap={1}>
            <AddIntegrationButton
              provider={provider}
              onAddIntegration={() => setInstalled(true)}
              organization={organization}
              priority="primary"
              size="sm"
              analyticsParams={{view: 'onboarding', already_installed: false}}
              modalParams={{projectId: project.id}}
            />
            <Button
              size="sm"
              to={{
                pathname: window.location.pathname,
                query: {manual: '1'},
              }}
              onClick={() => {
                props.onClickManualSetup?.();
                trackIntegrationAnalytics('integrations.switch_manual_sdk_setup', {
                  integration_type: 'first_party',
                  integration: integrationSlug,
                  view: 'onboarding',
                  organization,
                });
              }}
            >
              {t('Manual Setup')}
            </Button>
          </StyledButtonBar>
        </DocsWrapper>
      </Fragment>
    );
  };

  const renderPostInstallInstructions = () => {
    if (!project || !provider) {
      return null;
    }
    return (
      <Fragment>
        {renderSetupInstructions()}
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

  return (
    <Fragment>
      {installed ? renderPostInstallInstructions() : renderIntegrationInstructions()}
      {getDynamicText({
        value: !hasError ? null : loadingError,
        fixed: testOnlyAlert,
      })}
    </Fragment>
  );
}

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

export default IntegrationSetup;
